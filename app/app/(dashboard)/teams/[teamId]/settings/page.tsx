import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamSettingsForm } from '@/components/team/team-settings-form';
import { TeamMembersList } from '@/components/team/team-members-list';
import { LeaveTeamDialog } from '@/components/team/leave-team-dialog';
import { InviteTeamMembers } from '@/components/team-settings/invite-team-members';
import { PendingInvitationsList } from '@/components/team-settings/pending-invitations-list';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface TeamSettingsPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function TeamSettingsPage({ params, searchParams }: TeamSettingsPageProps) {
  const { teamId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || 'general';
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get team info and verify membership
  const { data: membership } = await supabase
    .from('team_members')
    .select(`
      role,
      team:teams(id, name, description)
    `)
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    redirect('/team');
  }

  const team = membership.team as unknown as { id: string; name: string; description: string | null } | null;
  const isAdmin = membership.role === 'admin';

  if (!team) {
    redirect('/team');
  }

  // Check if user is the last admin (needed for leave team functionality)
  let isLastAdmin = false;
  if (isAdmin) {
    const { data: isLast } = await supabase.rpc('is_last_admin', {
      p_team_id: teamId,
      p_user_id: user.id,
    });
    isLastAdmin = isLast === true;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to dashboard</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{team.name} Settings</h1>
          <p className="text-muted-foreground">Manage your team settings and members</p>
        </div>
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="invitations">Invitations</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Settings</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'Update your team name and description'
                  : 'View your team information'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamSettingsForm team={team} isAdmin={isAdmin} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Team</CardTitle>
              <CardDescription>
                Remove yourself from this team. You will lose access to all team projects and
                resources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaveTeamDialog
                teamId={teamId}
                teamName={team.name}
                isLastAdmin={isLastAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'Manage your team members and their roles'
                  : 'View team members'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamMembersList teamId={teamId} isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invitations" className="mt-6 space-y-6">
            <InviteTeamMembers teamId={teamId} />

            <Card>
              <CardHeader>
                <CardTitle>Pending Email Invitations</CardTitle>
                <CardDescription>
                  Email invitations that have been sent but not yet accepted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PendingInvitationsList teamId={teamId} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
