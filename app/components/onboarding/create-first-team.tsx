'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateTeamForm } from '@/components/team/create-team-form';
import { Users } from 'lucide-react';

export function CreateFirstTeam() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Welcome to Contextor!</CardTitle>
          <CardDescription className="text-base">
            Create your first team to start capturing and analyzing your prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTeamForm />
        </CardContent>
      </Card>
    </div>
  );
}
