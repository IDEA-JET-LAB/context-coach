'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCreateProject } from '@/lib/hooks/use-create-project';
import { createProjectSchema, type CreateProjectInput } from '@/lib/validations/project';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

interface NewProjectFormProps {
  onSuccess?: () => void;
}

export function NewProjectForm({ onSuccess }: NewProjectFormProps) {
  const { mutate: createProject, isPending } = useCreateProject();

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = (values: CreateProjectInput) => {
    createProject(values, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  // Handle escape key to cancel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        form.reset();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [form, isPending]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label="Create project form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="My Awesome Project"
                  disabled={isPending}
                  aria-required="true"
                  autoFocus
                />
              </FormControl>
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
                  placeholder="A brief description of your project..."
                  disabled={isPending}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Creating Project...
            </>
          ) : (
            'Create Project'
          )}
        </Button>
      </form>
    </Form>
  );
}
