import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dash/settings/")({
  beforeLoad: () => {
    throw redirect({
      to: "/dash/settings/profile",
    });
  },
});
