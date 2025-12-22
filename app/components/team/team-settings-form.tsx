'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useUpdateTeam } from '@/lib/hooks/use-update-team';
import { updateTeamSchema, type UpdateTeamInput } from '@/lib/validations/team';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MAX_DESCRIPTION_LENGTH = 500;

interface Team {
  id: string;
  name: string;
  description: string | null;
}

interface TeamSettingsFormProps {
  team: Team;
  isAdmin: boolean;
}

export function TeamSettingsForm({ team, isAdmin }: TeamSettingsFormProps) {
  const { mutate: updateTeam, isPending } = useUpdateTeam();

  const form = useForm<UpdateTeamInput>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: {
      name: team.name,
      description: team.description ?? '',
    },
  });

  const descriptionValue = form.watch('description');
  const descriptionLength = descriptionValue?.length ?? 0;

  const onSubmit = (values: UpdateTeamInput) => {
    updateTeam({
      teamId: team.id,
      name: values.name,
      description: values.description,
    });
  };

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Only team admins can edit settings. You are viewing this page in read-only mode.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          aria-label="Team settings form"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={!isAdmin || isPending}
                    aria-required="true"
                    maxLength={100}
                  />
                </FormControl>
                <FormDescription>
                  This is your team's display name (max 100 characters).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description <span className="text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    disabled={!isAdmin || isPending}
                    rows={4}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    placeholder="A brief description of your team..."
                  />
                </FormControl>
                <FormDescription className="flex justify-between">
                  <span>Describe what your team works on.</span>
                  <span
                    className={
                      descriptionLength > MAX_DESCRIPTION_LENGTH * 0.9
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                    aria-live="polite"
                  >
                    {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {isAdmin && (
            <Button
              type="submit"
              disabled={isPending || !form.formState.isDirty}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
}
