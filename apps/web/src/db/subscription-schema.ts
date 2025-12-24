import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./auth-schema";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"), // free, ray, beam
    status: text("status").notNull().default("active"), // active, cancelled, past_due, paused
    polarCustomerId: text("polar_customer_id"),
    polarSubscriptionId: text("polar_subscription_id"),
    polarProductId: text("polar_product_id"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    canceledAt: timestamp("canceled_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    extraMembers: integer("extra_members").default(0).notNull(), // Additional members beyond plan limit
    extraDomains: integer("extra_domains").default(0).notNull(), // Additional domains beyond plan limit (Ray only)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscriptions_organizationId_idx").on(table.organizationId),
    index("subscriptions_polarCustomerId_idx").on(table.polarCustomerId),
    index("subscriptions_polarSubscriptionId_idx").on(
      table.polarSubscriptionId,
    ),
  ],
);

export const subscriptionUsage = pgTable(
  "subscription_usage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // Format: YYYY-MM
    tunnelsUsed: integer("tunnels_used").default(0).notNull(),
    domainsUsed: integer("domains_used").default(0).notNull(),
    subdomainsUsed: integer("subdomains_used").default(0).notNull(),
    membersCount: integer("members_count").default(0).notNull(),
    requestsCount: integer("requests_count").default(0).notNull(),
    bandwidthBytes: integer("bandwidth_bytes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscription_usage_organizationId_idx").on(table.organizationId),
    index("subscription_usage_month_idx").on(table.month),
  ],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const subscriptionUsageRelations = relations(
  subscriptionUsage,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [subscriptionUsage.organizationId],
      references: [organizations.id],
    }),
  }),
);
