import { TeamWorkspace } from "@/components/professional-team/team-workspace";

export default async function ProfessionalTeamMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  return (
    <TeamWorkspace view="member" memberId={memberId} />
  );
}
