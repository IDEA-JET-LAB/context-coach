'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateLinkInvitation,
  useLinkInvitations,
  useRevokeLinkInvitation,
  type LinkInvitation,
} from '@/lib/hooks/use-invitations';
import {
  Loader2,
  LinkIcon,
  Copy,
  Check,
  X,
  Clock,
  Users,
  AlertCircle,
} from 'lucide-react';
import { showToast } from '@/components/feedback';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LinkInviteFormProps {
  teamId: string;
}

export function LinkInviteForm({ teamId }: LinkInviteFormProps) {
  const [maxUses, setMaxUses] = useState('10');
  const [expiresDays, setExpiresDays] = useState('7');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: linkInvitations, isPending: isLoadingLinks } = useLinkInvitations(teamId);
  const { mutate: createLink, isPending: isCreating, data: newLink } = useCreateLinkInvitation(teamId);
  const { mutate: revokeLink, isPending: isRevoking } = useRevokeLinkInvitation(teamId);

  const handleCreateLink = () => {
    createLink({
      maxUses: parseInt(maxUses, 10),
      expiresDays: parseInt(expiresDays, 10),
    });
  };

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      showToast.success('Link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast.error('Failed to copy link');
    }
  };

  const handleRevokeLink = (invitationId: string) => {
    revokeLink(invitationId);
  };

  return (
    <div className="space-y-6">
      {/* Create New Link Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-32">
            <Label htmlFor="max-uses" className="text-sm">Max Uses</Label>
            <Select value={maxUses} onValueChange={setMaxUses}>
              <SelectTrigger id="max-uses" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <Label htmlFor="expires-days" className="text-sm">Expires In</Label>
            <Select value={expiresDays} onValueChange={setExpiresDays}>
              <SelectTrigger id="expires-days" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleCreateLink} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Generate Link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Show newly created link */}
        {newLink && (
          <Alert className="bg-primary/5 border-primary/20">
            <LinkIcon className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-2">
              <Input
                value={newLink.url}
                readOnly
                className="flex-1 font-mono text-sm bg-background"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyLink(newLink.url, 'new')}
              >
                {copiedId === 'new' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Active Links List */}
      {isLoadingLinks ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : linkInvitations && linkInvitations.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Active Invite Links</h4>
          <div className="space-y-2">
            {linkInvitations.map((invite: LinkInvitation) => (
              <LinkInviteItem
                key={invite.id}
                invite={invite}
                onCopy={handleCopyLink}
                onRevoke={handleRevokeLink}
                isCopied={copiedId === invite.id}
                isRevoking={isRevoking}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No active invite links. Create one above to invite team members.
        </p>
      )}
    </div>
  );
}

interface LinkInviteItemProps {
  invite: LinkInvitation;
  onCopy: (url: string, id: string) => void;
  onRevoke: (id: string) => void;
  isCopied: boolean;
  isRevoking: boolean;
}

function LinkInviteItem({
  invite,
  onCopy,
  onRevoke,
  isCopied,
  isRevoking,
}: LinkInviteItemProps) {
  const expiresAt = new Date(invite.expires_at);
  const isExpired = expiresAt < new Date();
  const isMaxedOut = invite.max_uses !== null && invite.current_uses >= invite.max_uses;

  return (
    <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <code className="truncate text-xs bg-muted px-1.5 py-0.5 rounded">
            {invite.url.split('/').pop()?.slice(0, 8)}...
          </code>

          {(isExpired || isMaxedOut) && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {isExpired ? 'Expired' : 'Limit reached'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {invite.current_uses}/{invite.max_uses ?? 'unlimited'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {expiresAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCopy(invite.url, invite.id)}
          disabled={isExpired || isMaxedOut}
          title="Copy link"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRevoke(invite.id)}
          disabled={isRevoking}
          title="Revoke link"
          className="text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
