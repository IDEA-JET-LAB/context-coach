'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/forms';

const typescriptCode = `interface PromptAnalysis {
  id: string;
  prompt: string;
  score: number;
  dimensions: {
    clarity: number;
    specificity: number;
    context: number;
    complexity: number;
    communication: number;
  };
  feedback: string[];
  analyzedAt: Date;
}

async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  return response.json();
}`;

const bashCode = `# Install Contextor CLI
npm install -g @contextor/cli

# Initialize in your project
cd /path/to/your/project
npx contextor init YOUR_API_TOKEN

# Verify installation
cat .claude/settings.json | jq .hooks`;

const jsonCode = `{
  "analysis": {
    "dimensions": {
      "clarity": {
        "weight": 0.25,
        "description": "How clear and unambiguous is the prompt?"
      },
      "specificity": {
        "weight": 0.25,
        "description": "Does the prompt provide specific details?"
      },
      "context": {
        "weight": 0.20,
        "description": "Is sufficient context provided?"
      },
      "complexity": {
        "weight": 0.15,
        "description": "Is the complexity level appropriate?"
      },
      "communication": {
        "weight": 0.15,
        "description": "Is the communication style effective?"
      }
    }
  }
}`;

const shortCode = `const score = Math.round(avgScore * 10) / 10;`;

export default function CodePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Code Display</h1>
        <p className="mt-2 text-muted-foreground">
          Components for displaying code snippets with syntax highlighting and copy functionality.
        </p>
      </div>

      {/* CodeBlock */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">CodeBlock</CardTitle>
          <CardDescription>
            Display code with optional line numbers, title, and copy button.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* With line numbers */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">With Line Numbers</h4>
            <CodeBlock
              code={typescriptCode}
              language="typescript"
              title="lib/analysis.ts"
              showLineNumbers
            />
          </div>

          {/* Without line numbers */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">Simple Display</h4>
            <CodeBlock
              code={bashCode}
              language="bash"
              title="Installation"
            />
          </div>

          {/* JSON config */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">JSON Configuration</h4>
            <CodeBlock
              code={jsonCode}
              language="json"
              title="config.json"
              showLineNumbers
              maxHeight={200}
            />
          </div>

          {/* Inline / short code */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">Short Snippet</h4>
            <CodeBlock
              code={shortCode}
              language="javascript"
            />
          </div>

          {/* Without copy button */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">Without Copy Button</h4>
            <CodeBlock
              code="echo 'Hello, World!'"
              language="bash"
              copyable={false}
            />
          </div>

          {/* Props documentation */}
          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium text-foreground">Props</h4>
            <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">
{`interface CodeBlockProps {
  code: string;           // Code content
  language?: string;      // Language identifier (for display)
  showLineNumbers?: boolean;
  copyable?: boolean;     // Show copy button (default: true)
  title?: string;         // Optional title/filename
  maxHeight?: string | number;
  className?: string;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Future: Syntax Highlighting */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Future: Syntax Highlighting</CardTitle>
          <CardDescription>
            Planned enhancement: Add proper syntax highlighting with a library like Prism or Shiki.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Syntax highlighting will be added in a future iteration.
              <br />
              Consider using <code className="text-primary">shiki</code> or{' '}
              <code className="text-primary">prism-react-renderer</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
