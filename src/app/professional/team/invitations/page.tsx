import { TeamWorkspace } from "@/components/professional-team/team-workspace";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalTeamInvitationsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Team invitations"
      description="Invite staff into role-limited organisation access."
      hideIntro
    >
      <TeamWorkspace view="invitations" />
    </AuthenticatedShell>
  );
}
