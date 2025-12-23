'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InviteMemberForm } from './invite-member-form';
import { LinkInviteForm } from './link-invite-form';
import { Mail, LinkIcon, UserPlus } from 'lucide-react';

interface InviteTeamMembersProps {
  teamId: string;
  className?: string;
}

export function InviteTeamMembers({ teamId, className }: InviteTeamMembersProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Team Members
        </CardTitle>
        <CardDescription>
          Invite colleagues to join your team via email or a shareable link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Invite
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Invite Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a direct email invitation to a specific person. They&apos;ll receive an
              email with a link to join your team.
            </p>
            <InviteMemberForm teamId={teamId} />
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a shareable link that can be used by multiple people. Perfect for
              sharing in Slack, Discord, or other channels.
            </p>
            <LinkInviteForm teamId={teamId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
