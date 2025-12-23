'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TeamSettingsReadonlyProps {
  team: {
    name: string;
    description: string | null;
    created_at: string;
  };
}

export function TeamSettingsReadonly({ team }: TeamSettingsReadonlyProps) {
  return (
    <Card className="bg-background border-border" data-testid="team-settings-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Team Settings
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 cursor-help">
                <AlertCircle className="h-3 w-3" />
                View only
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Super admins can view team settings but cannot modify them.</p>
              <p className="mt-1">Team owners manage their own settings.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Team Name
          </label>
          <p className="mt-1 text-foreground">{team.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Description
          </label>
          <p className="mt-1 text-foreground">
            {team.description ?? 'No description'}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Created
          </label>
          <p className="mt-1 text-foreground">
            {new Date(team.created_at).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
