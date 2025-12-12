import { createFileRoute } from "@tanstack/react-router";
import { Activity, Network, Globe } from "lucide-react";

export const Route = createFileRoute("/dash/")({
  component: OverviewView,
});

function OverviewView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <OverviewCard
          title="Total Requests"
          value="1.2M"
          change="+12%"
          icon={<Activity />}
        />
        <OverviewCard
          title="Active Tunnels"
          value="3"
          change="+1"
          icon={<Network />}
        />
        <OverviewCard
          title="Data Transfer"
          value="45 GB"
          change="+5%"
          icon={<Globe />}
        />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6 h-96 flex items-center justify-center text-gray-500">
        Chart Placeholder
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-white/5 rounded-lg text-gray-300">{icon}</div>
        <span className="text-green-400 text-sm font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
          {change}
        </span>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}
