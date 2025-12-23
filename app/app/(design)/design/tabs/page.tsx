'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Settings, Users, FileText, Bell, Code } from 'lucide-react';

export default function TabsPage() {
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tabs & Navigation</h1>
        <p className="mt-2 text-muted-foreground">
          Tab components for switching between different views and content sections.
        </p>
      </div>

      {/* Basic Tabs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Basic Tabs</CardTitle>
          <CardDescription>
            Simple tabs for switching between content panels. Uses Radix UI for accessibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="account" className="w-full">
            <TabsList>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Account Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your account settings and preferences here.
              </p>
            </TabsContent>
            <TabsContent value="password" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Password Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Change your password and security settings.
              </p>
            </TabsContent>
            <TabsContent value="notifications" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how and when you receive notifications.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tabs with Icons */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Tabs with Icons</CardTitle>
          <CardDescription>
            Tabs with icons for better visual recognition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="analytics" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View your team's prompt analytics and trends.
              </p>
            </TabsContent>
            <TabsContent value="team" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Team Members</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage team members and roles.
              </p>
            </TabsContent>
            <TabsContent value="settings" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your workspace settings.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Width Tabs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Full Width Tabs</CardTitle>
          <CardDescription>
            Tabs that span the full width of the container.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="prompts" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="prompts">
                <FileText className="h-4 w-4 mr-2" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="responses">
                <Code className="h-4 w-4 mr-2" />
                Responses
              </TabsTrigger>
              <TabsTrigger value="feedback">
                <Bell className="h-4 w-4 mr-2" />
                Feedback
              </TabsTrigger>
              <TabsTrigger value="history">
                <BarChart3 className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>
            <TabsContent value="prompts" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Your Prompts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Browse all prompts you've submitted.
              </p>
            </TabsContent>
            <TabsContent value="responses" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">AI Responses</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View the responses generated for your prompts.
              </p>
            </TabsContent>
            <TabsContent value="feedback" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Feedback</h3>
              <p className="text-sm text-muted-foreground mt-1">
                See coaching feedback and suggestions.
              </p>
            </TabsContent>
            <TabsContent value="history" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">History</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View your prompt history over time.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Controlled Tabs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Controlled Tabs</CardTitle>
          <CardDescription>
            Tabs with controlled state for programmatic control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedTab('overview')}
              className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Go to Overview
            </button>
            <button
              onClick={() => setSelectedTab('details')}
              className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Go to Details
            </button>
            <button
              onClick={() => setSelectedTab('actions')}
              className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Go to Actions
            </button>
          </div>
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Overview</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Current tab: <code className="bg-muted px-1 rounded">{selectedTab}</code>
              </p>
            </TabsContent>
            <TabsContent value="details" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Details</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Current tab: <code className="bg-muted px-1 rounded">{selectedTab}</code>
              </p>
            </TabsContent>
            <TabsContent value="actions" className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
              <h3 className="font-medium text-foreground">Actions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Current tab: <code className="bg-muted px-1 rounded">{selectedTab}</code>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Usage Documentation */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Usage</CardTitle>
          <CardDescription>How to use the Tabs component.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`// Import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Basic Usage
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>

// Controlled Usage
const [tab, setTab] = useState('tab1');
<Tabs value={tab} onValueChange={setTab}>
  ...
</Tabs>

// With Icons
<TabsTrigger value="analytics" className="gap-2">
  <BarChart3 className="h-4 w-4" />
  Analytics
</TabsTrigger>

// Full Width Grid
<TabsList className="w-full grid grid-cols-4">
  ...
</TabsList>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Props Documentation */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Component Props</CardTitle>
          <CardDescription>Available props for Tabs components.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground">Tabs</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">defaultValue</code> - Initial active tab (uncontrolled)</li>
                <li><code className="bg-muted px-1 rounded">value</code> - Active tab value (controlled)</li>
                <li><code className="bg-muted px-1 rounded">onValueChange</code> - Callback when tab changes</li>
                <li><code className="bg-muted px-1 rounded">orientation</code> - "horizontal" | "vertical"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground">TabsTrigger</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">value</code> - Unique identifier for this tab</li>
                <li><code className="bg-muted px-1 rounded">disabled</code> - Disable this tab</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground">TabsContent</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">value</code> - Matches TabsTrigger value</li>
                <li><code className="bg-muted px-1 rounded">forceMount</code> - Force mount even when inactive</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Accessibility</CardTitle>
          <CardDescription>Built-in accessibility features.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>- Full keyboard navigation (Arrow keys, Tab, Enter)</li>
            <li>- Proper ARIA roles (tablist, tab, tabpanel)</li>
            <li>- Focus management and visible focus indicators</li>
            <li>- Screen reader announcements for tab changes</li>
            <li>- Automatic id linking between triggers and content</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
