import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  MoreVertical,
  X,
  Mail,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { useState } from "react";
import { useAppStore } from "../../lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlanLimits } from "../../lib/subscription-plans";
import axios from "axios";

export const Route = createFileRoute("/dash/members")({
  component: MembersView,
});

function MembersView() {
  const { selectedOrganizationId } = useAppStore();
  const queryClient = useQueryClient();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">(
    "member",
  );

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery(
    {
      queryKey: ["subscription", selectedOrganizationId],
      queryFn: async () => {
        if (!selectedOrganizationId) return null;
        const response = await axios.get(
          `/api/subscriptions/${selectedOrganizationId}`,
        );
        return response.data;
      },
      enabled: !!selectedOrganizationId,
    },
  );

  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["members", selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId) return [];
      const res = await authClient.organization.listMembers({
        query: {
          organizationId: selectedOrganizationId,
        },
      });
      return res.data?.members || [];
    },
    enabled: !!selectedOrganizationId,
  });

  const { data: invitationsData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ["invitations", selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId) return [];
      const res = await authClient.organization.listInvitations({
        query: {
          organizationId: selectedOrganizationId,
        },
      });
      // Filter out cancelled and accepted invitations
      const activeInvitations = (res.data || []).filter(
        (inv: any) =>
          inv.status !== "canceled" &&
          inv.status !== "cancelled" &&
          inv.status !== "accepted",
      );
      return activeInvitations;
    },
    enabled: !!selectedOrganizationId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      role: "member" | "admin" | "owner";
    }) => {
      const res = await authClient.organization.inviteMember({
        email: data.email,
        role: data.role,
        organizationId: selectedOrganizationId!,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["invitations", selectedOrganizationId],
      });
      setInviteEmail("");
      setIsInviteModalOpen(false);
    },
    onError: (error: Error) => {
      alert(error.message || "Failed to invite member");
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onMutate: async (invitationId) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["invitations", selectedOrganizationId],
      });
      const previousInvitations = queryClient.getQueryData([
        "invitations",
        selectedOrganizationId,
      ]);
      queryClient.setQueryData(
        ["invitations", selectedOrganizationId],
        (old: any[]) => old?.filter((inv) => inv.id !== invitationId) || [],
      );
      return { previousInvitations };
    },
    onError: (error: Error, _invitationId, context) => {
      // Revert on error
      if (context?.previousInvitations) {
        queryClient.setQueryData(
          ["invitations", selectedOrganizationId],
          context.previousInvitations,
        );
      }
      alert(error.message || "Failed to cancel invitation");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["invitations", selectedOrganizationId],
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: selectedOrganizationId!,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onMutate: async (memberId) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["members", selectedOrganizationId],
      });
      const previousMembers = queryClient.getQueryData([
        "members",
        selectedOrganizationId,
      ]);
      queryClient.setQueryData(
        ["members", selectedOrganizationId],
        (old: any[]) => old?.filter((member) => member.id !== memberId) || [],
      );
      return { previousMembers };
    },
    onError: (error: Error, _memberId, context) => {
      // Revert on error
      if (context?.previousMembers) {
        queryClient.setQueryData(
          ["members", selectedOrganizationId],
          context.previousMembers,
        );
      }
      alert(error.message || "Failed to remove member");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", selectedOrganizationId],
      });
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    cancelInvitationMutation.mutate(invitationId);
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    removeMemberMutation.mutate(memberId);
  };

  const members = membersData || [];
  const invitations = invitationsData || [];
  const isLoading =
    isLoadingMembers || isLoadingInvitations || isLoadingSubscription;

  const subscription = subscriptionData?.subscription;
  const currentPlan = subscription?.plan || "free";
  const planLimits = getPlanLimits(currentPlan as any);

  const currentMemberCount = members.length + invitations.length;
  const memberLimit = planLimits.maxMembers;
  const isAtLimit =
    memberLimit === -1 ? false : currentMemberCount >= memberLimit;
  const remainingSlots =
    memberLimit === -1 ? 999 : Math.max(0, memberLimit - currentMemberCount);

  const handleInviteClick = () => {
    if (isAtLimit) {
      alert(
        `You've reached your member limit (${memberLimit} members). Upgrade your plan or purchase additional member slots to invite more people.`,
      );
      return;
    }
    setIsInviteModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto relative animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-32 bg-white/5 rounded mb-2" />
            <div className="h-4 w-64 bg-white/5 rounded" />
          </div>
          <div className="h-10 w-36 bg-white/5 rounded-xl" />
        </div>

        <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden mb-6">
          <div className="p-6 border-b border-white/5">
            <div className="h-6 w-32 bg-white/5 rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5" />
                  <div>
                    <div className="h-4 w-32 bg-white/5 rounded mb-2" />
                    <div className="h-3 w-48 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="w-8 h-8 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Members
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage who has access to this organization · {currentMemberCount} /{" "}
            {memberLimit} members
          </p>
        </div>
        <button
          onClick={handleInviteClick}
          disabled={isAtLimit}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            isAtLimit
              ? "bg-white/10 text-gray-400 cursor-not-allowed"
              : "bg-white text-black hover:bg-gray-200"
          }`}
        >
          <Plus size={18} />
          Invite Member
        </button>
      </div>

      {isAtLimit && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">
              Member limit reached
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You've reached your plan's limit of {memberLimit} members.
              {currentPlan !== "free" && remainingSlots === 0 && (
                <>
                  {" "}
                  Go to{" "}
                  <a
                    href="/dash/billing"
                    className="text-yellow-500 hover:underline"
                  >
                    Billing
                  </a>{" "}
                  to add more member slots or upgrade your plan.
                </>
              )}
              {currentPlan === "free" && (
                <> Upgrade to a paid plan to invite more team members.</>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/2 border border-white/5 rounded-2xl overflow-hidden mb-6">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-medium text-white">Team Members</h3>
        </div>

        <div className="divide-y divide-white/5">
          {members.map((member) => (
            <div
              key={member.id}
              className="p-4 flex items-center justify-between hover:bg-white/2 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {member.user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-medium">
                      {member.user.name}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${member.role === "owner" ? "bg-accent/10 text-accent border-accent/20" : "bg-white/5 text-gray-400 border-white/10"}`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {member.role !== "owner" && (
                  <button
                    onClick={() => removeMember(member.id)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="p-4 flex items-center justify-between hover:bg-white/2 transition-colors opacity-75"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 font-bold">
                  <Mail size={18} />
                </div>
                <div>
                  <h4 className="text-gray-400 font-medium">
                    Invited: {invitation.email}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Role: {invitation.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium border border-yellow-500/20">
                  Pending
                </span>
                <button
                  onClick={() => cancelInvitation(invitation.id)}
                  className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}

          {members.length === 0 && invitations.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No members found
            </div>
          )}
        </div>
      </div>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#101010] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Invite Member</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-hidden focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                    placeholder="colleague@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Role
                </label>
                <div className="relative">
                  <Shield
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as "member" | "admin" | "owner",
                      )
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-hidden focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all appearance-none"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invitation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
