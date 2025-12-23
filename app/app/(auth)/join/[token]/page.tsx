'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { showToast } from '@/components/feedback';

interface InviteDetails {
  valid: boolean;
  reason?: string;
  team_name?: string;
  invited_by?: string;
  expires_at?: string;
  max_uses?: number;
  current_uses?: number;
  already_member?: boolean;
  is_authenticated?: boolean;
}

async function fetchInviteDetails(token: string): Promise<InviteDetails> {
  const response = await fetch(`/api/invites/${token}`);
  const result = await response.json();

  if (!response.ok && !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch invitation');
  }

  return result.data;
}

async function acceptInvite(token: string): Promise<{ team: { id: string; name: string } }> {
  const response = await fetch(`/api/invites/${token}`, {
    method: 'POST',
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.error?.message || 'Failed to join team') as Error & {
      code?: string;
    };
    error.code = result.error?.code;
    throw error;
  }

  return result.data;
}

export default function JoinTeamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Unwrap params
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  const {
    data: inviteDetails,
    isPending,
    error,
  } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInviteDetails(token!),
    enabled: !!token,
    retry: false,
  });

  const { mutate: joinTeam, isPending: isJoining } = useMutation({
    mutationFn: () => acceptInvite(token!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['current-team'] });
      showToast.success(`Welcome to ${data.team.name}!`);
      router.push('/team');
    },
    onError: (error: Error & { code?: string }) => {
      const messageMap: Record<string, string> = {
        INVALID_TOKEN: 'This invitation link is no longer valid',
        MAX_USES_REACHED: 'This invitation link has reached its maximum uses',
        ALREADY_MEMBER: 'You are already a member of this team',
      };

      showToast.error(messageMap[error.code || ''] || error.message);
    },
  });

  // Show loading state while token is being unwrapped or data is loading
  if (!token || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invalid invite state
  if (!inviteDetails?.valid) {
    const reasonMessages: Record<string, { title: string; description: string }> = {
      expired: {
        title: 'Invitation Expired',
        description: 'This invitation link has expired. Please ask for a new one.',
      },
      max_uses: {
        title: 'Link Limit Reached',
        description: 'This invitation link has reached its maximum number of uses.',
      },
      revoked: {
        title: 'Invitation Revoked',
        description: 'This invitation has been revoked by a team admin.',
      },
      not_found: {
        title: 'Invitation Not Found',
        description: 'This invitation link does not exist.',
      },
      invalid_token: {
        title: 'Invalid Link',
        description: 'This invitation link is invalid.',
      },
    };

    const reason = inviteDetails?.reason || 'not_found';
    const message = reasonMessages[reason] || { title: 'Invalid Link', description: 'This invitation link is invalid.' };

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              {reason === 'expired' ? (
                <Clock className="h-6 w-6 text-destructive" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <CardTitle>{message.title}</CardTitle>
            <CardDescription>{message.description}</CardDescription>
            {inviteDetails?.team_name && (
              <p className="mt-2 text-sm text-muted-foreground">
                Team: {inviteDetails.team_name}
              </p>
            )}
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show already member state
  if (inviteDetails.already_member) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Already a Member</CardTitle>
            <CardDescription>
              You&apos;re already a member of {inviteDetails.team_name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show valid invite with join option
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a team on Contextor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 text-center">
            <h3 className="text-lg font-semibold">{inviteDetails.team_name}</h3>
            {inviteDetails.invited_by && (
              <p className="text-sm text-muted-foreground">
                Invited by {inviteDetails.invited_by}
              </p>
            )}
          </div>

          {inviteDetails.expires_at && (
            <p className="text-center text-sm text-muted-foreground">
              <Clock className="mr-1 inline-block h-4 w-4" />
              Expires{' '}
              {new Date(inviteDetails.expires_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}

          {inviteDetails.is_authenticated ? (
            <Button
              className="w-full"
              onClick={() => joinTeam()}
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Join Team
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You need to log in or create an account to join this team.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/login?redirect=/join/${token}`}>Log In</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href={`/signup?redirect=/join/${token}`}>
                    Create Account
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
