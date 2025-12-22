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
  FormDescription,
} from '@/components/ui/form';
import { useUpdateProject } from '@/lib/hooks/use-update-project';
import { updateProjectSchema, type UpdateProjectInput } from '@/lib/validations/project';
import { Loader2 } from 'lucide-react';

interface ProjectSettingsFormProps {
  projectId: string;
  initialData: {
    name: string;
    description: string;
  };
  isAdmin: boolean;
  isArchived: boolean;
}

export function ProjectSettingsForm({
  projectId,
  initialData,
  isAdmin,
  isArchived,
}: ProjectSettingsFormProps) {
  const { mutate: updateProject, isPending } = useUpdateProject();

  const form = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description || '',
    },
  });

  const onSubmit = (values: UpdateProjectInput) => {
    updateProject({
      projectId,
      data: values,
    });
  };

  const isDisabled = !isAdmin || isArchived || isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label="Project settings form"
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
                  disabled={isDisabled}
                  aria-required="true"
                  aria-label="Project name"
                />
              </FormControl>
              <FormDescription>
                The name of your project (max 100 characters).
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
                  placeholder="A brief description of your project..."
                  disabled={isDisabled}
                  rows={3}
                  aria-label="Project description"
                />
              </FormControl>
              <FormDescription>
                A brief description of your project (max 500 characters).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isAdmin && !isArchived && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        )}

        {isArchived && (
          <p className="text-sm text-muted-foreground">
            This project is archived and cannot be modified.
          </p>
        )}
      </form>
    </Form>
  );
}
