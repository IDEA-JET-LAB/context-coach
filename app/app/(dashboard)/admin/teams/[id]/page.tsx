import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { TeamMembersList } from '@/components/admin/team-members-list';
import { TeamProjectsList } from '@/components/admin/team-projects-list';
import { TeamSettingsReadonly } from '@/components/admin/team-settings-readonly';
import { TeamActivitySummary } from '@/components/admin/team-activity-summary';
import { InlineAlert } from '@/components/feedback';
import { getTeamDetail } from '@/lib/db/queries/admin-teams';

interface TeamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id } = await params;

  let teamDetail;
  try {
    teamDetail = await getTeamDetail(id);
  } catch (error) {
    console.error('[AdminTeamDetail] Failed to fetch team:', error);
    notFound();
  }

  if (!teamDetail.team) {
    return (
      <div className="space-y-6" data-testid="admin-team-detail">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin/teams">Teams</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Team Not Found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <InlineAlert
          variant="error"
          title="Team Not Found"
          message="The team you are looking for does not exist or has been deleted."
          action={{
            label: 'Back to Teams',
            onClick: () => window.location.href = '/admin/teams',
          }}
        />
      </div>
    );
  }

  const { team, members, projects, recentPromptsCount, previousPeriodPromptsCount, mostActiveMembers, lastPromptAt } =
    teamDetail;

  return (
    <div className="space-y-6" data-testid="admin-team-detail">
      {/* Breadcrumb navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/teams">Teams</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{team.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Team header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{team.name}</h2>
        {team.description && (
          <p className="text-muted-foreground mt-1">{team.description}</p>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Members section */}
          <div className="rounded-lg border border-border bg-background p-6">
            <TeamMembersList members={members} />
          </div>

          {/* Projects section */}
          <div className="rounded-lg border border-border bg-background p-6">
            <TeamProjectsList projects={projects} />
          </div>
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-6">
          {/* Activity summary */}
          <TeamActivitySummary
            recentPromptsCount={recentPromptsCount}
            previousPeriodPromptsCount={previousPeriodPromptsCount}
            mostActiveMembers={mostActiveMembers}
            lastPromptAt={lastPromptAt}
          />

          {/* Team settings (read-only) */}
          <TeamSettingsReadonly team={team} />
        </div>
      </div>
    </div>
  );
}
