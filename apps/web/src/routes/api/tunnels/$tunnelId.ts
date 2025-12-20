import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
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
          .where(
            and(eq(tunnels.id, tunnelId), eq(tunnels.userId, session.user.id)),
          );

        if (!tunnel) {
          return json({ error: "Tunnel not found" }, { status: 404 });
        }

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

        const isOnline = subdomain
          ? await redis.exists(`tunnel:online:${subdomain}`)
          : false;

        return json({
          tunnel: {
            id: tunnel.id,
            url: tunnel.url,
            userId: tunnel.userId,
            name: tunnel.name,
            isOnline: !!isOnline,
            lastSeenAt: tunnel.lastSeenAt,
            createdAt: tunnel.createdAt,
            updatedAt: tunnel.updatedAt,
          },
        });
      },
      DELETE: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tunnelId } = params;

        const [tunnel] = await db
          .select()
          .from(tunnels)
          .where(
            and(eq(tunnels.id, tunnelId), eq(tunnels.userId, session.user.id)),
          );

        if (!tunnel) {
          return json({ error: "Tunnel not found" }, { status: 404 });
        }

        // Hard delete the tunnel record (cascade will delete subdomains)
        await db.delete(tunnels).where(eq(tunnels.id, tunnel.id));

        // Note: The tunnel server will continue to serve the tunnel if it's currently connected
        // because it manages the Redis key separately. This is fine - the tunnel stays active
        // until the client disconnects. Once deleted from DB, a new client can't register it.

        return json({ message: "Tunnel deleted" });
      },
    },
  },
});
