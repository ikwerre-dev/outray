import { Link } from "@tanstack/react-router";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  activeOptions?: { exact: boolean };
  isCollapsed: boolean;
}

export function NavItem({
  icon,
  label,
  to,
  activeOptions,
  isCollapsed,
}: NavItemProps) {
  return (
    <Link
      to={to}
      activeProps={{
        className:
          "bg-accent/10 text-accent font-medium border border-accent/20 shadow-[0_0_15px_rgba(255,166,43,0.1)]",
      }}
      inactiveProps={{
        className:
          "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent",
      }}
      activeOptions={activeOptions}
      className={`flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} w-full py-1 text-sm rounded-xl transition-all duration-200 group relative`}
    >
      {icon}
      {!isCollapsed && <span>{label}</span>}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-white/10">
          {label}
        </div>
      )}
    </Link>
  );
}
