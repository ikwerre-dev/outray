// Subscription plan definitions for Polar
export const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    features: {
      maxTunnels: 1,
      maxDomains: 0,
      maxSubdomains: 1,
      maxMembers: 1,
      requestsPerMonth: 1000,
      bandwidthPerMonth: 1024 * 1024 * 100, // 100MB
      retentionDays: 3,
      customDomains: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  ray: {
    name: "Ray",
    price: 7,
    polarProductId: process.env.POLAR_RAY_PRODUCT_ID,
    features: {
      maxTunnels: 3,
      maxDomains: 1, // 1 included, can add more with +$2 each (cap at 3 total)
      maxDomainsHardCap: 3,
      extraDomainPrice: 2,
      maxSubdomains: 5,
      maxMembers: 3, // 3 included, can add more with +$2 each (cap at 5 total)
      maxMembersHardCap: 5,
      extraMemberPrice: 2,
      requestsPerMonth: 100000,
      bandwidthPerMonth: 1024 * 1024 * 1024 * 10, // 10GB
      retentionDays: 14,
      customDomains: true,
      apiAccess: true,
      prioritySupport: false,
    },
  },
  beam: {
    name: "Beam",
    price: 15,
    polarProductId: process.env.POLAR_BEAM_PRODUCT_ID,
    features: {
      maxTunnels: 10,
      maxDomains: -1, // Unlimited
      maxSubdomains: 10,
      maxMembers: 5, // 5 included, can add more with +$3 each (no cap)
      extraMemberPrice: 3,
      requestsPerMonth: 1000000,
      bandwidthPerMonth: 1024 * 1024 * 1024 * 50, // 50GB
      retentionDays: 30,
      customDomains: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export function calculatePlanCost(
  plan: SubscriptionPlan,
  extraMembers: number = 0,
  extraDomains: number = 0,
): number {
  const basePlan = SUBSCRIPTION_PLANS[plan];
  let totalCost = basePlan.price;

  if (plan === "ray") {
    // Ray plan: +$2 per extra member (cap at 5 total), +$2 per extra domain (cap at 3 total)
    const rayFeatures = SUBSCRIPTION_PLANS.ray.features;
    const memberCost =
      Math.min(
        extraMembers,
        rayFeatures.maxMembersHardCap - rayFeatures.maxMembers,
      ) * rayFeatures.extraMemberPrice;
    const domainCost =
      Math.min(
        extraDomains,
        rayFeatures.maxDomainsHardCap - rayFeatures.maxDomains,
      ) * rayFeatures.extraDomainPrice;
    totalCost += memberCost + domainCost;
  } else if (plan === "beam") {
    // Beam plan: +$3 per extra member (no cap)
    const beamFeatures = SUBSCRIPTION_PLANS.beam.features;
    const memberCost = extraMembers * beamFeatures.extraMemberPrice;
    totalCost += memberCost;
  }

  return totalCost;
}

export function canUseFeature(
  plan: SubscriptionPlan,
  feature: keyof typeof SUBSCRIPTION_PLANS.free.features,
  currentUsage?: number,
  extraAllowance?: number,
): boolean {
  const planFeatures = SUBSCRIPTION_PLANS[plan].features;
  const limit = planFeatures[feature];

  // If limit is -1, it's unlimited
  if (limit === -1) return true;

  // For boolean features
  if (typeof limit === "boolean") return limit;

  // For numeric limits with current usage
  if (currentUsage !== undefined && typeof limit === "number") {
    const effectiveLimit = limit + (extraAllowance || 0);
    return currentUsage < effectiveLimit;
  }

  return true;
}

export function getPlanLimits(
  plan: SubscriptionPlan,
  extraMembers: number = 0,
  extraDomains: number = 0,
) {
  const baseLimits = SUBSCRIPTION_PLANS[plan].features;

  return {
    ...baseLimits,
    maxMembers: baseLimits.maxMembers + extraMembers,
    maxDomains:
      baseLimits.maxDomains === -1 ? -1 : baseLimits.maxDomains + extraDomains,
  };
}
