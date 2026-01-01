import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createClient } from "@clickhouse/client";

import { redis } from "../../../../lib/redis";
import { requireOrgFromSlug } from "../../../../lib/org";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/$orgSlug/stats/overview")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const orgResult = await requireOrgFromSlug(request, params.orgSlug);
        if ("error" in orgResult) return orgResult.error;
        const { organization } = orgResult;

        const url = new URL(request.url);
        const timeRange = url.searchParams.get("range") || "24h";
        const organizationId = organization.id;

        try {
          let interval = "24 HOUR";
          let prevIntervalStart = "48 HOUR";
          let prevIntervalEnd = "24 HOUR";

          switch (timeRange) {
            case "1h":
              interval = "1 HOUR";
              prevIntervalStart = "2 HOUR";
              prevIntervalEnd = "1 HOUR";
              break;
            case "7d":
              interval = "7 DAY";
              prevIntervalStart = "14 DAY";
              prevIntervalEnd = "7 DAY";
              break;
            case "30d":
              interval = "30 DAY";
              prevIntervalStart = "60 DAY";
              prevIntervalEnd = "30 DAY";
              break;
          }

          const totalRequestsResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT count() FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) +
                (SELECT count() FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const totalRequestsData =
            (await totalRequestsResult.json()) as Array<{ total: string }>;
          const totalRequests = parseInt(totalRequestsData[0]?.total || "0");

          const requestsYesterdayResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT count() FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${prevIntervalStart} AND timestamp < now64() - INTERVAL ${prevIntervalEnd}) +
                (SELECT count() FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${prevIntervalStart} AND timestamp < now64() - INTERVAL ${prevIntervalEnd}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const requestsYesterdayData =
            (await requestsYesterdayResult.json()) as Array<{ total: string }>;
          const requestsYesterday = parseInt(
            requestsYesterdayData[0]?.total || "0",
          );

          const recentRequestsResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT count() FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) +
                (SELECT count() FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const recentRequestsData =
            (await recentRequestsResult.json()) as Array<{ total: string }>;
          const recentRequests = parseInt(recentRequestsData[0]?.total || "0");

          const requestsChange =
            requestsYesterday > 0
              ? ((recentRequests - requestsYesterday) / requestsYesterday) * 100
              : recentRequests > 0
                ? 100
                : 0;

          const dataTransferResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT sum(bytes_in) + sum(bytes_out) FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) +
                (SELECT sum(bytes_in) + sum(bytes_out) FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataTransferData = (await dataTransferResult.json()) as Array<{
            total: string;
          }>;
          const totalBytes = Number(dataTransferData[0]?.total || 0);

          const dataYesterdayResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT sum(bytes_in) + sum(bytes_out) FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${prevIntervalStart} AND timestamp < now64() - INTERVAL ${prevIntervalEnd}) +
                (SELECT sum(bytes_in) + sum(bytes_out) FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${prevIntervalStart} AND timestamp < now64() - INTERVAL ${prevIntervalEnd}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataYesterdayData =
            (await dataYesterdayResult.json()) as Array<{
              total: string;
            }>;
          const bytesYesterday = Number(dataYesterdayData[0]?.total || 0);

          const dataRecentResult = await clickhouse.query({
            query: `
              SELECT 
                (SELECT sum(bytes_in) + sum(bytes_out) FROM tunnel_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) +
                (SELECT sum(bytes_in) + sum(bytes_out) FROM protocol_events WHERE organization_id = {organizationId:String} AND timestamp >= now64() - INTERVAL ${interval}) as total
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataRecentData = (await dataRecentResult.json()) as Array<{
            total: string;
          }>;
          const bytesRecent = Number(dataRecentData[0]?.total || 0);

          const dataTransferChange =
            bytesYesterday > 0
              ? ((bytesRecent - bytesYesterday) / bytesYesterday) * 100
              : bytesRecent > 0
                ? 100
                : 0;

          const activeTunnelsCount = await redis.scard(
            `org:${organizationId}:online_tunnels`,
          );

          let chartQuery = "";
          if (timeRange === "1h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfMinute(now64() - INTERVAL number MINUTE) as time
                FROM numbers(60)
              ),
              http_counts AS (
                SELECT toStartOfMinute(timestamp) as time, count() as cnt
                FROM tunnel_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL 1 HOUR
                GROUP BY time
              ),
              protocol_counts AS (
                SELECT toStartOfMinute(timestamp) as time, count() as cnt
                FROM protocol_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL 1 HOUR
                GROUP BY time
              )
              SELECT 
                t.time as time,
                COALESCE(h.cnt, 0) + COALESCE(p.cnt, 0) as requests
              FROM times t
              LEFT JOIN http_counts h ON t.time = h.time
              LEFT JOIN protocol_counts p ON t.time = p.time
              ORDER BY t.time ASC
            `;
          } else if (timeRange === "24h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfHour(now64() - INTERVAL number HOUR) as time
                FROM numbers(24)
              ),
              http_counts AS (
                SELECT toStartOfHour(timestamp) as time, count() as cnt
                FROM tunnel_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL 24 HOUR
                GROUP BY time
              ),
              protocol_counts AS (
                SELECT toStartOfHour(timestamp) as time, count() as cnt
                FROM protocol_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL 24 HOUR
                GROUP BY time
              )
              SELECT 
                t.time as time,
                COALESCE(h.cnt, 0) + COALESCE(p.cnt, 0) as requests
              FROM times t
              LEFT JOIN http_counts h ON t.time = h.time
              LEFT JOIN protocol_counts p ON t.time = p.time
              ORDER BY t.time ASC
            `;
          } else {
            const days = timeRange === "7d" ? 7 : 30;
            chartQuery = `
              WITH times AS (
                SELECT toStartOfDay(now64() - INTERVAL number DAY) as time
                FROM numbers(${days})
              ),
              http_counts AS (
                SELECT toStartOfDay(timestamp) as time, count() as cnt
                FROM tunnel_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL ${days} DAY
                GROUP BY time
              ),
              protocol_counts AS (
                SELECT toStartOfDay(timestamp) as time, count() as cnt
                FROM protocol_events
                WHERE organization_id = {organizationId:String}
                  AND timestamp >= now64() - INTERVAL ${days} DAY
                GROUP BY time
              )
              SELECT 
                t.time as time,
                COALESCE(h.cnt, 0) + COALESCE(p.cnt, 0) as requests
              FROM times t
              LEFT JOIN http_counts h ON t.time = h.time
              LEFT JOIN protocol_counts p ON t.time = p.time
              ORDER BY t.time ASC
            `;
          }

          const chartDataResult = await clickhouse.query({
            query: chartQuery,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const chartData = (await chartDataResult.json()) as Array<{
            time: string;
            requests: string;
          }>;

          return json({
            totalRequests,
            requestsChange,
            activeTunnels: activeTunnelsCount,
            activeTunnelsChange: 0,
            totalDataTransfer: totalBytes,
            dataTransferChange,
            chartData: chartData.map((d) => ({
              time: d.time,
              requests: parseInt(d.requests || "0"),
            })),
          });
        } catch (error) {
          console.error("Failed to fetch stats overview:", error);
          return json({ error: "Failed to fetch stats" }, { status: 500 });
        }
      },
    },
  },
});
