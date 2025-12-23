'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  InlineAlert,
  ConfirmationModal,
  EmptyState,
  NoPromptsEmptyState,
  NoSearchResultsEmptyState,
  NoTeamMembersEmptyState,
  NoAnalyticsDataEmptyState,
  showToast,
} from '@/components/feedback';
import { Trash2, LogOut, RefreshCw } from 'lucide-react';

export default function FeedbackPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const handleToastDemo = (type: 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise' | 'action') => {
    switch (type) {
      case 'success':
        showToast.success('Changes saved', { description: 'Your settings have been updated successfully.' });
        break;
      case 'error':
        showToast.error('Failed to save', { description: 'Please check your connection and try again.' });
        break;
      case 'warning':
        showToast.warning('Session expiring', { description: 'Your session will expire in 5 minutes.' });
        break;
      case 'info':
        showToast.info('New feature available', { description: 'Check out the new analytics dashboard!' });
        break;
      case 'loading':
        const loadingId = showToast.loading('Uploading file...');
        setTimeout(() => {
          showToast.dismiss(loadingId);
          showToast.success('File uploaded');
        }, 2000);
        break;
      case 'promise':
        const promise = new Promise((resolve) => setTimeout(resolve, 2000));
        showToast.promise(promise, {
          loading: 'Processing...',
          success: 'Processing complete!',
          error: 'Processing failed',
        });
        break;
      case 'action':
        showToast.action(
          'File deleted',
          { label: 'Undo', onClick: () => showToast.info('Restored!') },
          { description: 'The file has been moved to trash.' }
        );
        break;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Feedback Components</h1>
        <p className="mt-2 text-muted-foreground">
          Components for toasts, alerts, confirmation dialogs, and empty states.
        </p>
      </div>

      {/* Toast Variants */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Toast Notifications</CardTitle>
          <CardDescription>
            Consistent toast notifications using sonner with custom styling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleToastDemo('success')}>
              Success Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('error')}>
              Error Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('warning')}>
              Warning Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('info')}>
              Info Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('loading')}>
              Loading Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('promise')}>
              Promise Toast
            </Button>
            <Button variant="outline" onClick={() => handleToastDemo('action')}>
              Action Toast
            </Button>
          </div>
          <div className="mt-4 rounded-lg bg-muted p-4">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`// Usage
import { showToast } from '@/components/feedback';

showToast.success('Saved!');
showToast.error('Failed', { description: 'Details...' });
showToast.promise(apiCall(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed',
});`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Inline Alerts */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">InlineAlert</CardTitle>
          <CardDescription>Contextual alerts for inline messaging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!dismissedAlerts.includes('info') && (
            <InlineAlert
              variant="info"
              title="New Feature"
              message="You can now import transcripts from your local machine. Click below to get started."
              action={{ label: 'Learn more', onClick: () => {} }}
              dismissible
              onDismiss={() => setDismissedAlerts((a) => [...a, 'info'])}
            />
          )}
          {!dismissedAlerts.includes('success') && (
            <InlineAlert
              variant="success"
              title="Import Complete"
              message="Successfully imported 15 sessions with 234 prompts."
              dismissible
              onDismiss={() => setDismissedAlerts((a) => [...a, 'success'])}
            />
          )}
          <InlineAlert
            variant="warning"
            title="Quota Warning"
            message="You've used 80% of your monthly analysis quota. Consider upgrading your plan."
            action={{ label: 'Upgrade now', onClick: () => {} }}
          />
          <InlineAlert
            variant="error"
            message="Failed to connect to the analysis service. Please try again later."
          />
          {dismissedAlerts.length > 0 && (
            <button
              onClick={() => setDismissedAlerts([])}
              className="text-sm text-primary hover:underline"
            >
              Reset dismissed alerts
            </button>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modals */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ConfirmationModal</CardTitle>
          <CardDescription>Dialogs for confirming destructive or important actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
            <Button variant="outline" onClick={() => setShowLogoutModal(true)}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Button variant="outline" onClick={() => setShowRefreshModal(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Key
            </Button>
          </div>

          <ConfirmationModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            title="Delete Project"
            description="This will permanently delete the project and all associated data. This action cannot be undone."
            confirmLabel="Delete Project"
            onConfirm={() => setShowDeleteModal(false)}
            variant="destructive"
            icon={Trash2}
          />

          <ConfirmationModal
            open={showLogoutModal}
            onOpenChange={setShowLogoutModal}
            title="Sign Out"
            description="Are you sure you want to sign out? You'll need to sign in again to access your account."
            confirmLabel="Sign Out"
            onConfirm={() => setShowLogoutModal(false)}
            variant="warning"
            icon={LogOut}
          />

          <ConfirmationModal
            open={showRefreshModal}
            onOpenChange={setShowRefreshModal}
            title="Regenerate API Key"
            description="This will generate a new API key and invalidate the current one. You'll need to update any integrations using the old key."
            confirmLabel="Regenerate"
            onConfirm={() => setShowRefreshModal(false)}
            variant="info"
            icon={RefreshCw}
          />
        </CardContent>
      </Card>

      {/* Empty States */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Empty States</CardTitle>
          <CardDescription>Helpful empty state displays with actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border border-border rounded-lg">
              <NoPromptsEmptyState onAction={() => {}} />
            </div>
            <div className="border border-border rounded-lg">
              <NoSearchResultsEmptyState searchTerm="authentication" onClear={() => {}} />
            </div>
            <div className="border border-border rounded-lg">
              <NoTeamMembersEmptyState onInvite={() => {}} />
            </div>
            <div className="border border-border rounded-lg">
              <NoAnalyticsDataEmptyState />
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium text-foreground">Custom Empty State</h4>
            <div className="border border-border rounded-lg max-w-md">
              <EmptyState
                variant="folder"
                title="No projects"
                description="Create your first project to start tracking prompts."
                action={{ label: 'Create Project', onClick: () => {} }}
                secondaryAction={{ label: 'Learn more', onClick: () => {} }}
                size="lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
