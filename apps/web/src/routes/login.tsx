import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { FaGithub, FaGoogle } from "react-icons/fa";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: (search?: Record<string, unknown>): { redirect?: string } => {
    return {
      redirect: (search?.redirect as string) || undefined,
    };
  },
});

function RouteComponent() {
  const [loading, setLoading] = useState<string | null>(null);
  const { redirect } = Route.useSearch();
  const { data: session } = authClient.useSession();

  if (session?.user) {
    return <Navigate to="/select" />;
  }

  const handleLogin = async (provider: "github" | "google") => {
    setLoading(provider);
    await authClient.signIn.social({
      provider,
      callbackURL: redirect || "/dash",
      newUserCallbackURL: redirect || "/onboarding",
    });
    setLoading(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070707] text-gray-300">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/10">
              <div className="w-6 h-6 bg-black rounded-full" />
            </div>
            <p className="font-bold text-white text-2xl tracking-tight">
              OutRay
            </p>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to your account to continue
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleLogin("github")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "github" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <FaGithub className="h-5 w-5" />
            )}
            Continue with GitHub
          </button>

          <button
            onClick={() => handleLogin("google")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "google" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <FaGoogle className="h-5 w-5" />
            )}
            Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          By continuing, you agree to OutRay's Terms of Service and Privacy
          Policy
        </p>
      </div>
    </div>
  );
}
