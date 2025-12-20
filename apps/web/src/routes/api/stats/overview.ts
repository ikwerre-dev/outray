import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../db";
import { tunnels } from "../../../db/app-schema";
import { redis } from "../../../lib/redis";
import { createClient } from "@clickhouse/client";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/stats/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const organizationId = url.searchParams.get("organizationId");

        if (!organizationId) {
          return json({ error: "Organization ID required" }, { status: 400 });
        }

        const organizations = await auth.api.listOrganizations({
          headers: request.headers,
        });

        const hasAccess = organizations.find(
          (org) => org.id === organizationId,
        );

        if (!hasAccess) {
          return json({ error: "Unauthorized" }, { status: 403 });
        }

        try {
          const totalRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const totalRequestsData =
            (await totalRequestsResult.json()) as Array<{ total: string }>;
          const totalRequests = parseInt(totalRequestsData[0]?.total || "0");

          const requestsYesterdayResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL 48 HOUR
                AND timestamp < now64() - INTERVAL 24 HOUR
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const requestsYesterdayData =
            (await requestsYesterdayResult.json()) as Array<{ total: string }>;
          const requestsYesterday = parseInt(
            requestsYesterdayData[0]?.total || "1",
          );

          const recentRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL 24 HOUR
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
              : 0;

          const dataTransferResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataTransferData = (await dataTransferResult.json()) as Array<{
            total_in: string;
            total_out: string;
          }>;
          const totalBytesIn = Number(dataTransferData[0]?.total_in || 0);
          const totalBytesOut = Number(dataTransferData[0]?.total_out || 0);
          const totalBytes = totalBytesIn + totalBytesOut;

          const dataYesterdayResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL 48 HOUR
                AND timestamp < now64() - INTERVAL 24 HOUR
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataYesterdayData =
            (await dataYesterdayResult.json()) as Array<{
              total_in: string;
              total_out: string;
            }>;
          const bytesYesterdayIn = Number(dataYesterdayData[0]?.total_in || 0);
          const bytesYesterdayOut = Number(
            dataYesterdayData[0]?.total_out || 0,
          );
          const bytesYesterday = bytesYesterdayIn + bytesYesterdayOut;

          const dataRecentResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL 24 HOUR
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataRecentData = (await dataRecentResult.json()) as Array<{
            total_in: string;
            total_out: string;
          }>;
          const bytesRecentIn = Number(dataRecentData[0]?.total_in || 0);
          const bytesRecentOut = Number(dataRecentData[0]?.total_out || 0);
          const bytesRecent = bytesRecentIn + bytesRecentOut;

          const dataTransferChange =
            bytesYesterday > 0
              ? ((bytesRecent - bytesYesterday) / bytesYesterday) * 100
              : 0;

          // Get active tunnels count from database and check Redis for online status
          const userTunnels = await db
            .select({
              id: tunnels.id,
              url: tunnels.url,
            })
            .from(tunnels)
            .where(eq(tunnels.organizationId, organizationId));

          // Check how many are online in Redis
          let activeTunnelsCount = 0;
          for (const tunnel of userTunnels) {
            let subdomain = "";
            try {
              const urlObj = new URL(
                tunnel.url.startsWith("http")
                  ? tunnel.url
                  : `https://${tunnel.url}`,
              );
              subdomain = urlObj.hostname.split(".")[0];
            } catch (e) {
              console.error("Failed to parse tunnel URL:", tunnel.url);
            }

            if (subdomain) {
              const isOnline = await redis.exists(`tunnel:online:${subdomain}`);
              if (isOnline) {
                activeTunnelsCount++;
              }
            }
          }

          // Get hourly request counts for the last 24 hours
          const chartDataResult = await clickhouse.query({
            query: `
              WITH hours AS (
                SELECT toStartOfHour(now64() - INTERVAL number HOUR) as hour
                FROM numbers(24)
              )
              SELECT 
                h.hour as hour,
                countIf(t.timestamp IS NOT NULL) as requests
              FROM hours h
              LEFT JOIN tunnel_events t ON toStartOfHour(t.timestamp) = h.hour
                AND t.organization_id = {organizationId:String}
              GROUP BY h.hour
              ORDER BY h.hour ASC
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const chartData = (await chartDataResult.json()) as Array<{
            hour: string;
            requests: string;
          }>;

          return json({
            totalRequests,
            requestsChange: Math.round(requestsChange),
            activeTunnels: activeTunnelsCount,
            activeTunnelsChange: 0,
            totalDataTransfer: totalBytes,
            dataTransferChange: Math.round(dataTransferChange),
            chartData: chartData.map((d) => ({
              hour: d.hour,
              requests: parseInt(d.requests),
            })),
          });
        } catch (error) {
          console.error("Error fetching stats:", error);
          return json({ error: "Failed to fetch statistics" }, { status: 500 });
        }
      },
    },
  },
});
