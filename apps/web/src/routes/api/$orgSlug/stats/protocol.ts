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

export const Route = createFileRoute("/api/$orgSlug/stats/protocol")({
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
          const connectionsResult = await clickhouse.query({
            query: `
              SELECT 
                countIf(event_type = 'connection') as total_connections,
                uniqExact(connection_id) as unique_connections,
                uniqExact(concat(client_ip, ':', toString(client_port))) as unique_clients
              FROM protocol_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const connectionsData = (await connectionsResult.json()) as Array<{
            total_connections: string;
            unique_connections: string;
            unique_clients: string;
          }>;

          const bandwidthResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_bytes_in,
                sum(bytes_out) as total_bytes_out
              FROM protocol_events
              WHERE tunnel_id = {tunnelId:String}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const bandwidthData = (await bandwidthResult.json()) as Array<{
            total_bytes_in: string;
            total_bytes_out: string;
          }>;

          const packetsResult = await clickhouse.query({
            query: `
              SELECT 
                countIf(event_type = 'data' OR event_type = 'packet') as total_packets,
                countIf(event_type = 'close') as total_closes
              FROM protocol_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const packetsData = (await packetsResult.json()) as Array<{
            total_packets: string;
            total_closes: string;
          }>;

          const durationResult = await clickhouse.query({
            query: `
              SELECT avg(duration_ms) as avg_duration_ms
              FROM protocol_events
              WHERE tunnel_id = {tunnelId:String}
                AND event_type = 'close'
                AND duration_ms > 0
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const durationData = (await durationResult.json()) as Array<{
            avg_duration_ms: string;
          }>;

          let chartQuery = "";
          if (timeRange === "1h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfMinute(now64() - INTERVAL number MINUTE) as time
                FROM numbers(60)
              )
              SELECT 
                t.time as time,
                countIf(e.event_type = 'connection') as connections,
                countIf(e.event_type = 'data' OR e.event_type = 'packet') as packets,
                sum(e.bytes_in) as bytes_in,
                sum(e.bytes_out) as bytes_out
              FROM times t
              LEFT JOIN protocol_events e ON toStartOfMinute(e.timestamp) = t.time
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
                countIf(e.event_type = 'connection') as connections,
                countIf(e.event_type = 'data' OR e.event_type = 'packet') as packets,
                sum(e.bytes_in) as bytes_in,
                sum(e.bytes_out) as bytes_out
              FROM times t
              LEFT JOIN protocol_events e ON toStartOfHour(e.timestamp) = t.time
                AND e.tunnel_id = {tunnelId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else if (timeRange === "7d") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfDay(now64() - INTERVAL number DAY) as time
                FROM numbers(7)
              )
              SELECT 
                t.time as time,
                countIf(e.event_type = 'connection') as connections,
                countIf(e.event_type = 'data' OR e.event_type = 'packet') as packets,
                sum(e.bytes_in) as bytes_in,
                sum(e.bytes_out) as bytes_out
              FROM times t
              LEFT JOIN protocol_events e ON toStartOfDay(e.timestamp) = t.time
                AND e.tunnel_id = {tunnelId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfDay(now64() - INTERVAL number DAY) as time
                FROM numbers(30)
              )
              SELECT 
                t.time as time,
                countIf(e.event_type = 'connection') as connections,
                countIf(e.event_type = 'data' OR e.event_type = 'packet') as packets,
                sum(e.bytes_in) as bytes_in,
                sum(e.bytes_out) as bytes_out
              FROM times t
              LEFT JOIN protocol_events e ON toStartOfDay(e.timestamp) = t.time
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
            connections: string;
            packets: string;
            bytes_in: string;
            bytes_out: string;
          }>;

          const recentResult = await clickhouse.query({
            query: `
              SELECT 
                timestamp,
                event_type,
                connection_id,
                client_ip,
                client_port,
                bytes_in,
                bytes_out,
                duration_ms
              FROM protocol_events
              WHERE tunnel_id = {tunnelId:String}
              ORDER BY timestamp DESC
              LIMIT 50
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const recentEvents = (await recentResult.json()) as Array<{
            timestamp: string;
            event_type: string;
            connection_id: string;
            client_ip: string;
            client_port: number;
            bytes_in: number;
            bytes_out: number;
            duration_ms: number;
          }>;

          return json({
            protocol: tunnel.protocol,
            stats: {
              totalConnections: parseInt(
                connectionsData[0]?.total_connections || "0",
              ),
              uniqueConnections: parseInt(
                connectionsData[0]?.unique_connections || "0",
              ),
              uniqueClients: parseInt(
                connectionsData[0]?.unique_clients || "0",
              ),
              totalBytesIn: parseInt(bandwidthData[0]?.total_bytes_in || "0"),
              totalBytesOut: parseInt(bandwidthData[0]?.total_bytes_out || "0"),
              totalPackets: parseInt(packetsData[0]?.total_packets || "0"),
              totalCloses: parseInt(packetsData[0]?.total_closes || "0"),
              avgDurationMs: parseFloat(
                durationData[0]?.avg_duration_ms || "0",
              ),
            },
            chartData: chartData.map((row) => ({
              time: row.time,
              connections: parseInt(row.connections || "0"),
              packets: parseInt(row.packets || "0"),
              bytesIn: parseInt(row.bytes_in || "0"),
              bytesOut: parseInt(row.bytes_out || "0"),
            })),
            recentEvents,
            timeRange,
          });
        } catch (error) {
          console.error("Failed to fetch protocol stats:", error);
          return json({ error: "Failed to fetch stats" }, { status: 500 });
        }
      },
    },
  },
});
