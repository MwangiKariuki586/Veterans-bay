import { TeamWorkspace } from "@/components/professional-team/team-workspace";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalTeamMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  return (
    <AuthenticatedShell
      kind="professional"
      title="Member access"
      description="Review role, restrictions, and organisation activity."
      hideIntro
    >
      <TeamWorkspace view="member" memberId={memberId} />
    </AuthenticatedShell>
  );
}
