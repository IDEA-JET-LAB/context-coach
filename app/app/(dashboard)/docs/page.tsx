import Link from 'next/link';
import { docSections } from '@/lib/docs/config';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const metadata = {
  title: 'Documentation | Contextor',
  description: 'Learn how to use Contextor to improve your AI prompting skills.',
};

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Everything you need to know about using Contextor to improve your AI prompting skills.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docSections.map((section) => (
          <Link
            key={section.slug}
            href={`/docs/${section.slug}`}
            className="group"
          >
            <Card className="h-full transition-colors hover:bg-surface-hover">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="h-5 w-5" />
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
