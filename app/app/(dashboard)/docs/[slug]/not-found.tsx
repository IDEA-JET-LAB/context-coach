import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Page Not Found</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        The documentation page you&apos;re looking for doesn&apos;t exist. It may have been moved or removed.
      </p>
      <Button asChild>
        <Link href="/docs" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>
      </Button>
    </div>
  );
}
