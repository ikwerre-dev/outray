import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../db";
import { subscriptions } from "../../../db/subscription-schema";
import { eq, count } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { domains, subdomains } from "../../../db/app-schema";
import { members } from "../../../db/auth-schema";
import { redis } from "../../../lib/redis";

export const Route = createFileRoute("/api/subscriptions/$organizationId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { organizationId: string };
      }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
          });
        }

        const { organizationId } = params;

        try {
          // Get subscription
          const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.organizationId, organizationId))
            .limit(1);

          const [[domainCount], [subdomainCount], [memberCount], liveTunnels] =
            await Promise.all([
              db
                .select({ value: count() })
                .from(domains)
                .where(eq(domains.organizationId, organizationId)),
              db
                .select({ value: count() })
                .from(subdomains)
                .where(eq(subdomains.organizationId, organizationId)),
              db
                .select({ value: count() })
                .from(members)
                .where(eq(members.organizationId, organizationId)),
              // Live tunnels are tracked in Redis SET per org
              redis.scard(`org:${organizationId}:online_tunnels`),
            ]);

          return new Response(
            JSON.stringify({
              subscription: subscription || null,
              usage: {
                tunnels: Number(liveTunnels ?? 0),
                domains: Number(domainCount?.value ?? 0),
                subdomains: Number(subdomainCount?.value ?? 0),
                members: Number(memberCount?.value ?? 0),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (error) {
          console.error("Error fetching subscription:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch subscription" }),
            { status: 500 },
          );
        }
      },
    },
  },
});
