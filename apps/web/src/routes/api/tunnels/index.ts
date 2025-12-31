import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../db";
import { tunnels } from "../../../db/app-schema";
import { redis } from "../../../lib/redis";

export const Route = createFileRoute("/api/tunnels/")({
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

        // Get online tunnel IDs from Redis SET
        const onlineIds = await redis.smembers(
          `org:${organizationId}:online_tunnels`,
        );

        if (onlineIds.length === 0) {
          return json({ tunnels: [] });
        }

        // Fetch tunnels from Postgres
        const dbTunnels = await db
          .select()
          .from(tunnels)
          .where(inArray(tunnels.id, onlineIds));

        // Batch fetch lastSeen timestamps
        const lastSeenKeys = onlineIds.map((id) => `tunnel:last_seen:${id}`);
        const lastSeenValues = await redis.mget(...lastSeenKeys);
        const lastSeenMap = new Map(
          onlineIds.map((id, i) => [id, lastSeenValues[i]]),
        );

        // Map to response
        const result = dbTunnels.map((t) => ({
          id: t.id,
          url: t.url,
          userId: t.userId,
          name: t.name,
          protocol: t.protocol || "http",
          remotePort: t.remotePort,
          isOnline: true,
          lastSeenAt: new Date(Number(lastSeenMap.get(t.id)) || Date.now()),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));

        return json({ tunnels: result });
      },
    },
  },
});
