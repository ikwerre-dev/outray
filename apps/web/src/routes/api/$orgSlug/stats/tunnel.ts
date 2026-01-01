import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { createClient } from "@clickhouse/client";
import { db } from "../../../../db";
import { tunnels } from "../../../../db/app-schema";
import { requireOrgFromSlug } from "../../../../lib/org";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/$orgSlug/stats/tunnel")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { orgSlug } = params;
        const url = new URL(request.url);
        const tunnelId = url.searchParams.get("tunnelId");
        const timeRange = url.searchParams.get("range") || "24h";

        const orgContext = await requireOrgFromSlug(request, orgSlug);
        if ("error" in orgContext) {
          return orgContext.error;
        }

        if (!tunnelId) {
          return json({ error: "Tunnel ID required" }, { status: 400 });
        }

        const [tunnel] = await db
          .select()
          .from(tunnels)
          .where(eq(tunnels.id, tunnelId));

        if (!tunnel) {
          return json({ error: "Tunnel not found" }, { status: 404 });
        }

        if (tunnel.organizationId !== orgContext.organization.id) {
          return json({ error: "Unauthorized" }, { status: 403 });
        }

        let interval = "24 HOUR";
        if (timeRange === "1h") {
          interval = "1 HOUR";
        } else if (timeRange === "7d") {
          interval = "7 DAY";
        } else if (timeRange === "30d") {
          interval = "30 DAY";
        }

        try {
          const totalRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const totalRequestsData =
            (await totalRequestsResult.json()) as Array<{ total: string }>;
          const totalRequests = parseInt(totalRequestsData[0]?.total || "0");

          const durationResult = await clickhouse.query({
            query: `
              SELECT avg(request_duration_ms) as avg_duration
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const durationData = (await durationResult.json()) as Array<{
            avg_duration: string;
          }>;
          const avgDuration = parseFloat(durationData[0]?.avg_duration || "0");

          const bandwidthResult = await clickhouse.query({
            query: `
              SELECT sum(bytes_in + bytes_out) as total_bytes
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const bandwidthData = (await bandwidthResult.json()) as Array<{
            total_bytes: string;
          }>;
          const totalBandwidth = parseInt(bandwidthData[0]?.total_bytes || "0");

          const errorRateResult = await clickhouse.query({
            query: `
              SELECT 
                countIf(status_code >= 400) as errors,
                count() as total
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const errorRateData = (await errorRateResult.json()) as Array<{
            errors: string;
            total: string;
          }>;
          const errorCount = parseInt(errorRateData[0]?.errors || "0");
          const totalCount = parseInt(errorRateData[0]?.total || "0");
          const errorRate =
            totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

          let chartQuery = "";
          if (timeRange === "1h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfMinute(now64() - INTERVAL number MINUTE) as time
                FROM numbers(60)
              )
              SELECT 
                t.time as time,
                countIf(e.tunnel_id = {tunnelId:String}) as requests,
                avg(e.request_duration_ms) as duration
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfMinute(e.timestamp) = t.time
                AND e.tunnel_id = {tunnelId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else if (timeRange === "24h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfHour(now64() - INTERVAL number HOUR) as time
                FROM numbers(24)
              )
              SELECT 
                t.time as time,
                countIf(e.tunnel_id = {tunnelId:String}) as requests,
                avg(e.request_duration_ms) as duration
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfHour(e.timestamp) = t.time
                AND e.tunnel_id = {tunnelId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else {
            const days = timeRange === "7d" ? 7 : 30;
            chartQuery = `
              WITH times AS (
                SELECT toStartOfDay(now64() - INTERVAL number DAY) as time
                FROM numbers(${days})
              )
              SELECT 
                t.time as time,
                countIf(e.tunnel_id = {tunnelId:String}) as requests,
                avg(e.request_duration_ms) as duration
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfDay(e.timestamp) = t.time
                AND e.tunnel_id = {tunnelId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          }

          const chartResult = await clickhouse.query({
            query: chartQuery,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const chartData = (await chartResult.json()) as Array<{
            time: string;
            requests: string;
            duration: string | null;
          }>;

          const requestsResult = await clickhouse.query({
            query: `
              SELECT 
                timestamp,
                method,
                path,
                status_code,
                request_duration_ms,
                bytes_in + bytes_out as size
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
              ORDER BY timestamp DESC
              LIMIT 50
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const requests = (await requestsResult.json()) as Array<any>;

          return json({
            stats: {
              totalRequests,
              avgDuration,
              totalBandwidth,
              errorRate,
            },
            chartData: chartData.map((d) => ({
              time: d.time,
              requests: parseInt(d.requests),
              duration: d.duration ? parseFloat(d.duration) : 0,
            })),
            requests: requests.map((r) => ({
              id: r.timestamp,
              method: r.method,
              path: r.path,
              status: r.status_code,
              duration: r.request_duration_ms,
              time: r.timestamp,
              size: r.size,
            })),
          });
        } catch (error) {
          console.error("Failed to fetch tunnel stats:", error);
          return json({ error: "Failed to fetch stats" }, { status: 500 });
        }
      },
    },
  },
});
