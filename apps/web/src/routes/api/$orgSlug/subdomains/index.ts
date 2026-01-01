import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { db } from "../../../../db";
import { subdomains } from "../../../../db/app-schema";
import { subscriptions } from "../../../../db/subscription-schema";
import { requireOrgFromSlug } from "../../../../lib/org";
import { getPlanLimits } from "../../../../lib/subscription-plans";

export const Route = createFileRoute("/api/$orgSlug/subdomains/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const orgResult = await requireOrgFromSlug(request, params.orgSlug);
        if ("error" in orgResult) return orgResult.error;
        const { organization } = orgResult;

        const results = await db
          .select()
          .from(subdomains)
          .where(eq(subdomains.organizationId, organization.id));

        return json({ subdomains: results });
      },
      POST: async ({ request, params }) => {
        const orgResult = await requireOrgFromSlug(request, params.orgSlug);
        if ("error" in orgResult) return orgResult.error;
        const { organization, session } = orgResult;

        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { subdomain } = body as { subdomain?: string };

        if (!subdomain) {
          return json({ error: "Subdomain is required" }, { status: 400 });
        }

        const subdomainRegex = /^[a-z0-9-]+$/;
        if (!subdomainRegex.test(subdomain)) {
          return json(
            {
              error:
                "Invalid subdomain format. Use lowercase letters, numbers, and hyphens.",
            },
            { status: 400 },
          );
        }

        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.organizationId, organization.id));

        const currentPlan = subscription?.plan || "free";
        const planLimits = getPlanLimits(currentPlan as any);
        const subdomainLimit = planLimits.maxSubdomains;

        const existingSubdomains = await db
          .select()
          .from(subdomains)
          .where(eq(subdomains.organizationId, organization.id));

        if (existingSubdomains.length >= subdomainLimit) {
          return json(
            {
              error: `Subdomain limit reached. The ${currentPlan} plan allows ${subdomainLimit} subdomain${subdomainLimit > 1 ? "s" : ""}.`,
            },
            { status: 403 },
          );
        }

        const existing = await db
          .select()
          .from(subdomains)
          .where(eq(subdomains.subdomain, subdomain))
          .limit(1);

        if (existing.length > 0) {
          return json({ error: "Subdomain already taken" }, { status: 409 });
        }

        const [newSubdomain] = await db
          .insert(subdomains)
          .values({
            id: crypto.randomUUID(),
            subdomain,
            organizationId: organization.id,
            userId: session.user.id,
          })
          .returning();

        return json({ subdomain: newSubdomain });
      },
    },
  },
});
