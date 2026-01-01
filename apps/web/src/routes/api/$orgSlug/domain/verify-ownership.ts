import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../db";
import { domains } from "../../../../db/app-schema";
import { requireOrgFromSlug } from "../../../../lib/org";

export const Route = createFileRoute("/api/$orgSlug/domain/verify-ownership")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const orgResult = await requireOrgFromSlug(request, params.orgSlug);
          if ("error" in orgResult) return orgResult.error;
          const { organization } = orgResult;

          const body = (await request.json()) as {
            domain?: string;
          };

          const { domain } = body;

          if (!domain) {
            return json(
              { valid: false, error: "Missing required fields" },
              { status: 400 },
            );
          }

          const [existingDomain] = await db
            .select()
            .from(domains)
            .where(
              and(
                eq(domains.domain, domain),
                eq(domains.organizationId, organization.id),
              ),
            );

          if (!existingDomain) {
            return json({
              valid: false,
              error: "Domain not found or does not belong to your organization",
            });
          }

          if (existingDomain.status !== "active") {
            return json({
              valid: false,
              error: "Domain is not verified. Please verify DNS records first.",
            });
          }

          return json({ valid: true });
        } catch (error) {
          console.error("Domain verification error:", error);
          return json(
            { valid: false, error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
