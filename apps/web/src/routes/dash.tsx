import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Network,
  Settings,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/dash")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const location = useLocation();
  const path = location.pathname.split("/").pop() || "overview";
  const title = path === "dash" ? "overview" : path;

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20">
      {/* Background Gradient/Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl flex flex-col">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-full" />
              </div>
              outray
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <NavItem
              to="/dash"
              icon={<LayoutDashboard size={18} />}
              label="Overview"
              activeOptions={{ exact: true }}
            />
            <NavItem
              to="/dash/tunnels"
              icon={<Network size={18} />}
              label="Tunnels"
            />
            <NavItem
              to="/dash/settings"
              icon={<Settings size={18} />}
              label="Settings"
            />
          </nav>

          <div className="p-4 border-t border-white/10">
            <button className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10">
            <h1 className="text-lg font-medium text-white capitalize">
              {title}
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                System Operational
              </div>
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-gray-700 to-gray-600 border border-white/10" />
            </div>
          </header>

          <div className="p-8 max-w-6xl mx-auto space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  to,
  activeOptions,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  activeOptions?: { exact: boolean };
}) {
  return (
    <Link
      to={to}
      activeProps={{
        className:
          "bg-white text-black font-medium shadow-[0_0_15px_rgba(255,255,255,0.3)]",
      }}
      inactiveProps={{
        className: "text-gray-400 hover:text-white hover:bg-white/5",
      }}
      activeOptions={activeOptions}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-all duration-200"
    >
      {icon}
      {label}
    </Link>
  );
}
