import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Check, Zap, Crown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../lib/store";
import {
  SUBSCRIPTION_PLANS,
  getPlanLimits,
  calculatePlanCost,
} from "../../lib/subscription-plans";
import axios from "axios";

export const Route = createFileRoute("/dash/billing")({
  component: BillingView,
});

function BillingView() {
  const { selectedOrganizationId } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription", selectedOrganizationId],
    queryFn: async () => {
      const response = await axios.get(
        `/api/subscriptions/${selectedOrganizationId}`,
      );
      return response.data;
    },
    enabled: !!selectedOrganizationId,
  });

  const subscription = data?.subscription;
  const usage = data?.usage;
  const currentPlan = subscription?.plan || "free";
  const extraMembers = subscription?.extraMembers || 0;
  const extraDomains = subscription?.extraDomains || 0;
  const planLimits = getPlanLimits(
    currentPlan as any,
    extraMembers,
    extraDomains,
  );
  const monthlyCost = calculatePlanCost(
    currentPlan as any,
    extraMembers,
    extraDomains,
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Billing & Subscription
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your subscription and billing details
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* Current Plan Overview */}
          <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden mb-8">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <CreditCard className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      Current Plan:{" "}
                      {
                        SUBSCRIPTION_PLANS[
                          currentPlan as keyof typeof SUBSCRIPTION_PLANS
                        ].name
                      }
                    </h3>
                    <p className="text-sm text-gray-500">
                      {subscription?.status === "active"
                        ? "Active subscription"
                        : "No active subscription"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">
                    ${monthlyCost}
                  </p>
                  <p className="text-sm text-gray-500">/month</p>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Tunnels</p>
                <p className="text-lg font-semibold text-white">
                  {usage?.tunnelsUsed || 0} / {planLimits.maxTunnels}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Domains</p>
                <p className="text-lg font-semibold text-white">
                  {usage?.domainsUsed || 0} /{" "}
                  {planLimits.maxDomains === -1 ? "∞" : planLimits.maxDomains}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Subdomains</p>
                <p className="text-lg font-semibold text-white">
                  {usage?.subdomainsUsed || 0} / {planLimits.maxSubdomains}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Members</p>
                <p className="text-lg font-semibold text-white">
                  {usage?.membersCount || 0} / {planLimits.maxMembers}
                </p>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6">
              Available Plans
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Free Plan */}
              <PlanCard
                name="Free"
                price={0}
                icon={<Check className="w-6 h-6" />}
                description="For testing & experimenting"
                features={[
                  "1 Active Tunnel",
                  "1 Subdomain",
                  "1 Team Member",
                  "100MB Bandwidth",
                  "1K Requests/month",
                  "3 Days Retention",
                ]}
                current={currentPlan === "free"}
                onSelect={() => {}}
              />

              {/* Ray Plan */}
              <PlanCard
                name="Ray"
                price={7}
                icon={<Zap className="w-6 h-6" />}
                description="For solo devs & tiny teams"
                features={[
                  "3 Active Tunnels",
                  "5 Subdomains",
                  "3 Team Members (+$2/member, cap 5)",
                  "1 Custom Domain (+$2/domain, cap 3)",
                  "10GB Bandwidth",
                  "100K Requests/month",
                  "14 Days Retention",
                  "API Access",
                ]}
                current={currentPlan === "ray"}
                recommended
                extraInfo={
                  currentPlan === "ray"
                    ? `+${extraMembers} members, +${extraDomains} domains`
                    : undefined
                }
                onSelect={() => {}}
              />

              {/* Beam Plan */}
              <PlanCard
                name="Beam"
                price={15}
                icon={<Crown className="w-6 h-6" />}
                description="For teams shipping real things"
                features={[
                  "10 Active Tunnels",
                  "10 Subdomains",
                  "5 Team Members (+$3/extra)",
                  "Unlimited Custom Domains",
                  "50GB Bandwidth",
                  "1M Requests/month",
                  "30 Days Retention",
                  "API Access",
                  "Priority Support",
                ]}
                current={currentPlan === "beam"}
                extraInfo={
                  currentPlan === "beam" && extraMembers > 0
                    ? `+${extraMembers} members`
                    : undefined
                }
                onSelect={() => {}}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  icon,
  description,
  features,
  current,
  recommended,
  extraInfo,
  onSelect,
}: {
  name: string;
  price: number;
  icon: React.ReactNode;
  description: string;
  features: string[];
  current?: boolean;
  recommended?: boolean;
  extraInfo?: string;
  onSelect: () => void;
}) {
  return (
    <div
      className={`bg-white/2 border rounded-2xl overflow-hidden ${
        recommended
          ? "border-accent shadow-lg shadow-accent/10 ring-2 ring-accent/20"
          : "border-white/5"
      }`}
    >
      {recommended && (
        <div className="bg-accent text-black text-xs font-bold text-center py-2 px-4">
          RECOMMENDED
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`p-2 rounded-lg ${recommended ? "bg-accent/10 text-accent" : "bg-white/5 text-gray-400"}`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{name}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>

        <div className="flex items-baseline gap-1 mb-1 mt-4">
          <span className="text-4xl font-bold text-white">${price}</span>
          <span className="text-gray-500">/month</span>
        </div>
        {extraInfo && <p className="text-xs text-accent mb-4">{extraInfo}</p>}

        <ul className="space-y-2.5 mb-6 mt-6">
          {features.map((feature, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 text-sm text-gray-300"
            >
              <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          disabled={current}
          className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
            current
              ? "bg-white/10 text-gray-400 cursor-not-allowed"
              : recommended
                ? "bg-accent text-black hover:bg-accent/90"
                : "bg-white text-black hover:bg-gray-200"
          }`}
        >
          {current ? "Current Plan" : "Upgrade"}
        </button>
      </div>
    </div>
  );
}
