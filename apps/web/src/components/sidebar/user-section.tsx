import { useNavigate } from "@tanstack/react-router";
import { HelpCircle, LogOut } from "lucide-react";
import { authClient } from "../../lib/auth-client";

interface UserSectionProps {
  user: any;
  isCollapsed: boolean;
}

export function UserSection({ user, isCollapsed }: UserSectionProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    navigate({ to: "/login", search: { redirect: undefined } });
  };

  return (
    <div className="p-3 border-t border-white/5 space-y-2 bg-black/20">
      <button
        className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} w-full px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors group`}
      >
        <HelpCircle size={20} />
        {!isCollapsed && <span>Help & Support</span>}
      </button>

      <div
        className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-2 py-2 mt-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group border border-transparent hover:border-white/5`}
      >
        <div className="w-9 h-9 rounded-full bg-linear-to-tr from-accent to-orange-600 flex items-center justify-center text-black font-bold text-xs shadow-lg shadow-accent/20 shrink-0">
          {user?.name?.substring(0, 2).toUpperCase() || "U"}
        </div>
        {!isCollapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate group-hover:text-accent transition-colors">
                {user?.name || "User"}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user?.email || "user@example.com"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
