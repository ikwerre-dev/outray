import { createFileRoute } from "@tanstack/react-router";
import { Plus, Globe, Copy, Settings, Terminal } from "lucide-react";

export const Route = createFileRoute("/dash/tunnels")({
  component: TunnelsView,
});

function TunnelsView() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Active Tunnels</h2>
          <p className="text-gray-500 text-sm">
            Manage your active tunnel connections.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          <Plus size={18} />
          New Tunnel
        </button>
      </div>

      <div className="grid gap-4">
        {/* Mock Tunnel Card */}
        <div className="group relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300 hover:bg-white/[0.07]">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  api-production
                  <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] border border-green-500/20 uppercase tracking-wider font-bold">
                    Online
                  </span>
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span className="font-mono">https://api.outray.dev</span>
                  <button className="hover:text-white transition-colors">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                  Uptime
                </div>
                <div className="text-white font-mono">24h 12m</div>
              </div>
              <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
            <Stat label="Requests/min" value="1,240" />
            <Stat label="Avg Latency" value="45ms" />
            <Stat label="Data Transfer" value="2.4 GB" />
          </div>
        </div>

        {/* Empty State Placeholder */}
        <div className="border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-white/2">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-gray-500 mb-4">
            <Terminal size={24} />
          </div>
          <h3 className="text-white font-medium mb-1">Start a new tunnel</h3>
          <p className="text-gray-500 text-sm max-w-xs mb-4">
            Run the CLI command to start forwarding traffic to your local
            machine.
          </p>
          <code className="px-3 py-1.5 bg-black/50 border border-white/10 rounded-md text-sm font-mono text-gray-300">
            outray 8080
          </code>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
        {label}
      </div>
      <div className="text-white font-mono text-lg">{value}</div>
    </div>
  );
}
