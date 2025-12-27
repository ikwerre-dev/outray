interface PlanUsageProps {
  activeTunnelsCount: number;
  isCollapsed: boolean;
}

export function PlanUsage({ activeTunnelsCount, isCollapsed }: PlanUsageProps) {
  if (isCollapsed) return null;

  return (
    <div className="px-3 py-2 bg-linear-to-br from-accent/10 to-transparent rounded-xl border border-accent/10 mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-accent">Free Plan</span>
        <span className="text-[10px] text-accent/70">
          {activeTunnelsCount}/5 Tunnels
        </span>
      </div>
      <div className="h-1.5 bg-accent/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ width: `${(activeTunnelsCount / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}
