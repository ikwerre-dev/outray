import { createFileRoute } from "@tanstack/react-router";
import { db } from "../../../db";
import {
  subscriptions,
  subscriptionUsage,
} from "../../../db/subscription-schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../../../lib/auth";

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

          // Get current month usage
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          const [usage] = await db
            .select()
            .from(subscriptionUsage)
            .where(
              and(
                eq(subscriptionUsage.organizationId, organizationId),
                eq(subscriptionUsage.month, currentMonth),
              ),
            )
            .limit(1);

          return new Response(
            JSON.stringify({
              subscription: subscription || null,
              usage: usage || null,
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
