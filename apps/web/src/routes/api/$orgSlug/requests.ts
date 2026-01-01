import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { createClient } from "@clickhouse/client";

import { requireOrgFromSlug } from "../../../lib/org";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/$orgSlug/requests")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const orgResult = await requireOrgFromSlug(request, params.orgSlug);
        if ("error" in orgResult) return orgResult.error;
        const { organization } = orgResult;

        const url = new URL(request.url);
        const tunnelId = url.searchParams.get("tunnelId");
        const timeRange = url.searchParams.get("range") || "1h";
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const search = url.searchParams.get("search");

        let interval = "1 HOUR";
        if (timeRange === "24h") {
          interval = "24 HOUR";
        } else if (timeRange === "7d") {
          interval = "7 DAY";
        } else if (timeRange === "30d") {
          interval = "30 DAY";
        }

        const organizationId = organization.id;

        try {
          let query = `
              SELECT 
                timestamp,
                tunnel_id,
                organization_id,
                host,
                method,
                path,
                status_code,
                request_duration_ms,
                bytes_in,
                bytes_out,
                client_ip,
                user_agent
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
          `;

          const queryParams: Record<string, any> = {
            organizationId,
            limit,
          };

          if (tunnelId) {
            query += ` AND tunnel_id = {tunnelId:String}`;
            queryParams.tunnelId = tunnelId;
          }

          if (search) {
            query += ` AND (path ILIKE {searchPattern:String} OR method ILIKE {searchPattern:String} OR host ILIKE {searchPattern:String})`;
            queryParams.searchPattern = `%${search}%`;
          }

          query += ` ORDER BY timestamp DESC LIMIT {limit:UInt32}`;

          const requestsResult = await clickhouse.query({
            query,
            query_params: queryParams,
            format: "JSONEachRow",
          });

          const requests = (await requestsResult.json()) as Array<any>;

          return json({
            requests,
            timeRange,
            count: requests.length,
          });
        } catch (error) {
          console.error("Failed to fetch requests:", error);
          return json({ error: "Failed to fetch requests" }, { status: 500 });
        }
      },
    },
  },
});
