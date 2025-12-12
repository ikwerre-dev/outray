import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dash/settings")({
  component: SettingsView,
});

function SettingsView() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      <div className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Username
              </label>
              <input
                type="text"
                value="akinloluwami"
                readOnly
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value="user@example.com"
                readOnly
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
