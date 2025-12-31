import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../db";
import { tunnels } from "../../../db/app-schema";
import { redis } from "../../../lib/redis";

export const Route = createFileRoute("/api/tunnels/$tunnelId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tunnelId } = params;

        const [tunnel] = await db
          .select()
          .from(tunnels)
          .where(eq(tunnels.id, tunnelId));

        if (!tunnel) {
          return json({ error: "Tunnel not found" }, { status: 404 });
        }

        if (tunnel.organizationId) {
          const organizations = await auth.api.listOrganizations({
            headers: request.headers,
          });
          const hasAccess = organizations.find(
            (org) => org.id === tunnel.organizationId,
          );
          if (!hasAccess) {
            return json({ error: "Unauthorized" }, { status: 403 });
          }
        } else if (tunnel.userId !== session.user.id) {
          return json({ error: "Unauthorized" }, { status: 403 });
        }

        // Determine the Redis key for online status based on protocol
        let onlineTunnelId = "";
        const protocol = tunnel.protocol || "http";

        if (protocol === "tcp" || protocol === "udp") {
          // For TCP/UDP, the tunnel name is stored directly (e.g., "rational-chipmunk")
          // Extract from URL like "tcp://rational-chipmunk.localhost.direct:20001"
          try {
            const urlObj = new URL(tunnel.url);
            const hostParts = urlObj.hostname.split(".");
            onlineTunnelId = hostParts[0]; // Just the adjective-noun part
          } catch (e) {
            console.error("Failed to parse tunnel URL:", tunnel.url);
          }
        } else {
          // For HTTP, use full hostname
          try {
            const urlObj = new URL(
              tunnel.url.startsWith("http")
                ? tunnel.url
                : `https://${tunnel.url}`,
            );
            onlineTunnelId = urlObj.hostname;
          } catch (e) {
            console.error("Failed to parse tunnel URL:", tunnel.url);
          }
        }

        const isOnline = onlineTunnelId
          ? await redis.exists(`tunnel:online:${onlineTunnelId}`)
          : false;

        return json({
          tunnel: {
            id: tunnel.id,
            url: tunnel.url,
            userId: tunnel.userId,
            name: tunnel.name,
            protocol,
            remotePort: tunnel.remotePort,
            isOnline: !!isOnline,
            lastSeenAt: tunnel.lastSeenAt,
            createdAt: tunnel.createdAt,
            updatedAt: tunnel.updatedAt,
          },
        });
      },
    },
  },
});
