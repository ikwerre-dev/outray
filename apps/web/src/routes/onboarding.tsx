import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await authClient.getSession();
        if (!session.data) {
          navigate({ to: "/login" });
          return;
        }
        if (session.data.session.activeOrganizationId) {
          navigate({ to: "/dash" });
          return;
        }
      } catch (error) {
        console.error("Failed to check session:", error);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await authClient.organization.create({
        name,
        slug,
      });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        await fetch("/api/auth-tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Default Token",
            organizationId: data.id,
          }),
        });

        await authClient.organization.setActive({
          organizationId: data.id,
        });

        navigate({ to: "/dash/install" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Create your organization
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Set up your workspace to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-400"
              >
                Organization Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (
                    !slug ||
                    slug === name.toLowerCase().replace(/\s+/g, "-")
                  ) {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }
                }}
                className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:border-white/30 focus:bg-white/10"
                placeholder="My Company"
              />
            </div>

            <div>
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-gray-400"
              >
                Organization Slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition-all focus:border-white/30 focus:bg-white/10"
                placeholder="my-company"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-white px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
