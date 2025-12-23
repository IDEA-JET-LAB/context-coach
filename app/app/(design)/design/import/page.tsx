'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionPreviewCard, ImportProgressBar, FileTree, FileTreeNode, SessionPreviewData } from '@/components/import';
import { RecoveryBanner, SessionSnapshot } from '@/components/recovery';

// Sample data
const sampleSessions: SessionPreviewData[] = [
  {
    id: '1',
    filename: 'transcript_2024-01-15_session1.jsonl',
    startTime: new Date('2024-01-15T10:00:00'),
    endTime: new Date('2024-01-15T10:45:00'),
    promptCount: 23,
    status: 'pending',
  },
  {
    id: '2',
    filename: 'transcript_2024-01-14_session2.jsonl',
    startTime: new Date('2024-01-14T14:30:00'),
    endTime: new Date('2024-01-14T16:00:00'),
    promptCount: 45,
    status: 'imported',
  },
  {
    id: '3',
    filename: 'transcript_2024-01-13_session3.jsonl',
    startTime: new Date('2024-01-13T09:00:00'),
    promptCount: 12,
    status: 'error',
    error: 'Failed to parse JSON at line 45',
  },
  {
    id: '4',
    filename: 'transcript_2024-01-12_session4.jsonl',
    startTime: new Date('2024-01-12T11:00:00'),
    endTime: new Date('2024-01-12T12:30:00'),
    promptCount: 18,
    status: 'duplicate',
  },
];

const sampleFileTree: FileTreeNode[] = [
  {
    id: 'root',
    name: '.claude',
    type: 'folder',
    children: [
      {
        id: 'transcripts',
        name: 'transcripts',
        type: 'folder',
        children: [
          { id: 'f1', name: '2024-01-15_session1.jsonl', type: 'file' },
          { id: 'f2', name: '2024-01-14_session2.jsonl', type: 'file' },
          { id: 'f3', name: '2024-01-13_session3.jsonl', type: 'file' },
        ],
      },
      {
        id: 'hooks',
        name: 'hooks',
        type: 'folder',
        children: [
          { id: 'h1', name: 'contextor-capture.sh', type: 'file' },
        ],
      },
    ],
  },
];

export default function ImportPage() {
  const [selectedSessions, setSelectedSessions] = useState<string[]>(['1']);
  const [selectedFiles, setSelectedFiles] = useState<string[]>(['f1', 'f3']);
  const [showBanner, setShowBanner] = useState(true);

  const toggleSession = (id: string, selected: boolean) => {
    setSelectedSessions((prev) =>
      selected ? [...prev, id] : prev.filter((s) => s !== id)
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import & Recovery</h1>
        <p className="mt-2 text-muted-foreground">
          Components for importing transcript files and recovering interrupted sessions.
        </p>
      </div>

      {/* RecoveryBanner */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">RecoveryBanner</CardTitle>
          <CardDescription>Prompt users to resume an interrupted session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showBanner && (
            <RecoveryBanner
              sessionName="feature-auth-implementation"
              interruptedAt={new Date(Date.now() - 2 * 60 * 60 * 1000)}
              promptCount={15}
              onResume={() => alert('Resume clicked')}
              onDismiss={() => setShowBanner(false)}
            />
          )}
          {!showBanner && (
            <button
              onClick={() => setShowBanner(true)}
              className="text-sm text-primary hover:underline"
            >
              Show banner again
            </button>
          )}
        </CardContent>
      </Card>

      {/* SessionSnapshot */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SessionSnapshot</CardTitle>
          <CardDescription>Show context from where the user left off.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl">
            <SessionSnapshot
              startTime={new Date('2024-01-15T10:00:00')}
              lastActivityTime={new Date('2024-01-15T11:45:00')}
              workingDirectory="/Users/dev/projects/my-app"
              gitBranch="feature/auth-implementation"
              promptCount={15}
              lastPrompt="Help me implement the password reset flow. The user should receive an email with a reset link, and clicking it should take them to a form where they can enter a new password."
              context="cd /Users/dev/projects/my-app && npm run dev"
            />
          </div>
        </CardContent>
      </Card>

      {/* SessionPreviewCard */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SessionPreviewCard</CardTitle>
          <CardDescription>Preview sessions for import with status indicators.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl space-y-3">
            {sampleSessions.map((session) => (
              <SessionPreviewCard
                key={session.id}
                session={session}
                selected={selectedSessions.includes(session.id)}
                onSelectionChange={(selected) => toggleSession(session.id, selected)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ImportProgressBar */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">ImportProgressBar</CardTitle>
          <CardDescription>Show import progress through different phases.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xl space-y-6">
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Discovering</h4>
              <ImportProgressBar
                phase="discovering"
                progress={30}
                currentFile="~/.claude/transcripts/"
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Parsing</h4>
              <ImportProgressBar
                phase="parsing"
                progress={45}
                processed={5}
                total={12}
                currentFile="transcript_2024-01-15.jsonl"
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Importing</h4>
              <ImportProgressBar
                phase="importing"
                progress={80}
                processed={8}
                total={10}
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Complete</h4>
              <ImportProgressBar
                phase="complete"
                progress={100}
                processed={10}
                total={10}
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Error</h4>
              <ImportProgressBar
                phase="error"
                progress={60}
                error="Failed to connect to database"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FileTree */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">FileTree</CardTitle>
          <CardDescription>Browse and select transcript files.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <FileTree
              data={sampleFileTree}
              selectedIds={selectedFiles}
              onSelectionChange={setSelectedFiles}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Selected: {selectedFiles.join(', ') || 'None'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
