import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ImportHistoryList } from '@/components/settings/import-history-list';
import { Loader2, ArrowLeft, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HistoricalImportRow, ImportRecord } from '@/lib/import/types';
import { rowToImportRecord } from '@/lib/import/types';

async function ImportHistoryContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?message=session-expired');
  }

  const { data: importRows, error } = await supabase
    .from('historical_imports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch import history:', error);
  }

  const imports: ImportRecord[] = (importRows as HistoricalImportRow[] | null)?.map(rowToImportRecord) || [];

  return (
    <div className="container max-w-4xl py-8">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Import History</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your historical prompt imports.
        </p>
      </div>

      {/* Content */}
      {imports.length > 0 ? (
        <ImportHistoryList imports={imports} />
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground text-lg">No imports yet</h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Import history will appear here after you import transcripts from your Claude Code sessions.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Start Import</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ImportHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ImportHistoryContent />
    </Suspense>
  );
}
