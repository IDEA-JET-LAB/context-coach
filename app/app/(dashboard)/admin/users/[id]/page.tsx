import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUserDetail } from '@/lib/services/admin-users';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserActions } from '@/components/admin/user-actions';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, Mail, Users, FileText, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'User Details | Admin',
  description: 'View user details and manage account',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const userDetail = await getUserDetail(id);

  if (!userDetail) {
    notFound();
  }

  const { teams, promptsCount, ...user } = userDetail;

  function formatLastActive(lastActiveAt: string | null): string {
    if (!lastActiveAt) {
      return 'Never';
    }
    try {
      return formatDistanceToNow(new Date(lastActiveAt), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return format(new Date(dateStr), 'PPP');
    } catch {
      return 'Unknown';
    }
  }

  return (
    <div data-testid="user-detail-page" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/users" aria-label="Back to users list">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">User Details</h2>
          <p className="text-muted-foreground">
            View and manage this user account.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="lg:col-span-2 bg-background border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Account Information</CardTitle>
            <CardDescription>Basic user details and account status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p data-testid="user-email" className="text-foreground font-medium">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-foreground font-medium">
                  {user.name || 'Not set'}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Account Status</p>
                <div data-testid="user-status" className="flex items-center gap-2 mt-1">
                  {user.is_disabled ? (
                    <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Active
                    </Badge>
                  )}
                  {user.is_super_admin && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Super Admin
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Last Active */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Last Active</p>
                <p className="text-foreground font-medium">
                  {formatLastActive(user.last_active_at)}
                </p>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Account Created</p>
                <p className="text-foreground font-medium">
                  {formatDate(user.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Actions</CardTitle>
            <CardDescription>Manage this user account.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserActions
              userId={user.id}
              userEmail={user.email}
              isDisabled={user.is_disabled}
              isSuperAdmin={user.is_super_admin}
            />
          </CardContent>
        </Card>
      </div>

      {/* Teams Card */}
      <Card data-testid="user-teams" className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Team Memberships</CardTitle>
          <CardDescription>Teams this user belongs to.</CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No team memberships.</p>
          ) : (
            <div className="space-y-3">
              {teams.map((membership) => (
                <div
                  key={membership.team.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card"
                >
                  <div>
                    <p className="font-medium text-foreground">{membership.team.name}</p>
                    <p className="text-sm text-muted-foreground">ID: {membership.team.id}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {membership.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Activity Statistics</CardTitle>
          <CardDescription>User activity and usage statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Prompts</p>
                  <p data-testid="user-prompts-count" className="text-2xl font-bold text-foreground">
                    {promptsCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Team Memberships</p>
                  <p className="text-2xl font-bold text-foreground">{teams.length}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
