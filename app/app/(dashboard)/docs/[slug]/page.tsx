import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowLeft } from 'lucide-react';
import { docSections, getDocSection, isValidDocSlug } from '@/lib/docs/config';
import { Button } from '@/components/ui/button';

interface DocPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return docSections.map((section) => ({
    slug: section.slug,
  }));
}

export async function generateMetadata({ params }: DocPageProps) {
  const { slug } = await params;
  const section = getDocSection(slug);

  if (!section) {
    return {
      title: 'Not Found | Contextor Docs',
    };
  }

  return {
    title: `${section.title} | Contextor Docs`,
    description: section.description,
  };
}

function getDocContent(slug: string): string | null {
  try {
    const filePath = path.join(process.cwd(), 'content', 'docs', `${slug}.md`);
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;

  // Validate slug
  if (!isValidDocSlug(slug)) {
    notFound();
  }

  const section = getDocSection(slug);
  const content = getDocContent(slug);

  if (!section) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/docs" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Documentation
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <section.icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{section.title}</h1>
            <p className="text-muted-foreground">{section.description}</p>
          </div>
        </div>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        {content ? (
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {content}
          </ReactMarkdown>
        ) : (
          <p className="text-muted-foreground">
            Content for this section is being prepared. Check back soon!
          </p>
        )}
      </div>
    </article>
  );
}
