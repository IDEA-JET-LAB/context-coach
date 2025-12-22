'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useInviteMember } from '@/lib/hooks/use-invitations';
import { inviteEmailSchema, type InviteEmailInput } from '@/lib/validations/invitation';
import { Loader2, Send } from 'lucide-react';

interface InviteMemberFormProps {
  teamId: string;
}

export function InviteMemberForm({ teamId }: InviteMemberFormProps) {
  const { mutate: inviteMember, isPending } = useInviteMember(teamId);

  const form = useForm<InviteEmailInput>({
    resolver: zodResolver(inviteEmailSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = (values: InviteEmailInput) => {
    inviteMember(values.email, {
      onSuccess: () => {
        form.reset();
      },
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex gap-3 items-end"
        aria-label="Invite team member"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Invite by Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="colleague@company.com"
                  disabled={isPending}
                  autoComplete="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Invite
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
