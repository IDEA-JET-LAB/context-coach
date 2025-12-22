'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useValidateInvitation, useAcceptInvitation } from '@/lib/hooks/use-invitations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { data: invitation, isLoading, error } = useValidateInvitation(token);
  const { mutate: acceptInvitation, isPending: isAccepting } = useAcceptInvitation();

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setIsCheckingAuth(false);
    }
    checkAuth();
  }, [supabase]);

  // Handle accepting invitation
  const handleAccept = () => {
    acceptInvitation(token, {
      onSuccess: () => {
        router.push('/team');
        router.refresh();
      },
    });
  };

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Loading state
  if (isLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    const errorWithCode = error as Error & { code?: string };
    const isExpired = errorWithCode.code === 'EXPIRED';
    const isRevoked = errorWithCode.code === 'REVOKED';

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>
              {isExpired
                ? 'Invitation Expired'
                : isRevoked
                  ? 'Invitation Revoked'
                  : 'Invalid Invitation'}
            </CardTitle>
            <CardDescription>{error.message}</CardDescription>
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

  // Valid invitation - check auth status
  if (!user) {
    // User not authenticated - redirect to signup with token
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              Join <strong>{invitation?.teamName}</strong> on Contextor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                This invitation was sent to <strong>{invitation?.email}</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link
                  href={`/signup?invite_token=${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                >
                  Create Account to Join
                </Link>
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Already have an account?
              </div>

              <Button asChild variant="outline" className="w-full">
                <Link href={`/login?next=/invite/${token}`}>Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated - check email match
  const userEmail = user.email?.toLowerCase();
  const invitationEmail = invitation?.email?.toLowerCase();
  const emailMatches = userEmail === invitationEmail;

  if (!emailMatches) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-yellow-500/10 rounded-full w-fit">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
            <CardTitle>Email Mismatch</CardTitle>
            <CardDescription>
              Join <strong>{invitation?.teamName}</strong> on Contextor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Wrong Account</AlertTitle>
              <AlertDescription>
                You're signed in as <strong>{userEmail}</strong>, but this invitation was
                sent to <strong>{invitationEmail}</strong>.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Sign out to use a different account
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email matches - show accept button
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            Join <strong>{invitation?.teamName}</strong> on Contextor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Signed in as <strong>{userEmail}</strong>
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full"
            size="lg"
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining Team...
              </>
            ) : (
              'Join Team'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
