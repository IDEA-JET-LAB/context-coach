'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiStepForm, WeightSlider, TagInput, CodeBlock, JsonEditor, RuleEditor, RuleGroup } from '@/components/forms';

const sampleCode = `function analyzePrompt(prompt: string): Score {
  const dimensions = calculateDimensions(prompt);
  const totalScore = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight,
    0
  );

  return {
    total: totalScore,
    dimensions,
    feedback: generateFeedback(dimensions),
  };
}`;

const sampleJson = `{
  "name": "clarity",
  "weight": 0.25,
  "thresholds": {
    "low": 3,
    "medium": 6,
    "high": 8
  }
}`;

export default function FormsPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [weights, setWeights] = useState({
    clarity: 25,
    specificity: 25,
    context: 25,
    complexity: 25,
  });
  const [tags, setTags] = useState(['react', 'typescript', 'nextjs']);
  const [json, setJson] = useState(sampleJson);
  const [rules, setRules] = useState<RuleGroup>({
    id: 'group1',
    joiner: 'AND',
    rules: [
      { id: 'rule1', field: 'score', operator: 'greater_than', value: '7' },
      { id: 'rule2', field: 'dimension', operator: 'equals', value: 'clarity' },
    ],
  });

  const steps = [
    { id: 'basic', title: 'Basic Info', description: 'Enter your basic information' },
    { id: 'config', title: 'Configuration', description: 'Configure your preferences' },
    { id: 'review', title: 'Review', description: 'Review and submit' },
  ];

  const ruleFields = [
    { value: 'score', label: 'Score' },
    { value: 'dimension', label: 'Dimension' },
    { value: 'user', label: 'User' },
    { value: 'team', label: 'Team' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Forms & Editors</h1>
        <p className="mt-2 text-muted-foreground">
          Advanced form components for multi-step workflows, rule editing, and configuration.
        </p>
      </div>

      {/* MultiStepForm */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">MultiStepForm</CardTitle>
          <CardDescription>Wizard-style form with step indicators and navigation.</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiStepForm
            steps={steps}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            clickableSteps
            onSubmit={() => alert('Form submitted!')}
          >
            {({ step }) => (
              <div className="space-y-4">
                {step === 0 && (
                  <>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="Enter your name" className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" placeholder="Enter your email" className="mt-1" />
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div>
                      <Label>Notification frequency</Label>
                      <Input placeholder="Daily, Weekly, Monthly" className="mt-1" />
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Input placeholder="UTC-5" className="mt-1" />
                    </div>
                  </>
                )}
                {step === 2 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Review your settings and click Submit.</p>
                  </div>
                )}
              </div>
            )}
          </MultiStepForm>
        </CardContent>
      </Card>

      {/* WeightSlider */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">WeightSlider</CardTitle>
          <CardDescription>Labeled range input for configuring weights and percentages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-md space-y-4">
            <WeightSlider
              label="Clarity Weight"
              value={weights.clarity}
              onChange={(v) => setWeights((w) => ({ ...w, clarity: v }))}
              description="How much clarity affects the overall score"
            />
            <WeightSlider
              label="Specificity Weight"
              value={weights.specificity}
              onChange={(v) => setWeights((w) => ({ ...w, specificity: v }))}
            />
            <WeightSlider
              label="Context Weight"
              value={weights.context}
              onChange={(v) => setWeights((w) => ({ ...w, context: v }))}
            />
            <WeightSlider
              label="Complexity Weight"
              value={weights.complexity}
              onChange={(v) => setWeights((w) => ({ ...w, complexity: v }))}
            />
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Total: {weights.clarity + weights.specificity + weights.context + weights.complexity}%
              {weights.clarity + weights.specificity + weights.context + weights.complexity !== 100 && (
                <span className="text-score-growth ml-2">(Should equal 100%)</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* TagInput */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">TagInput</CardTitle>
          <CardDescription>Multi-value text input for tags, keywords, and categories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-md">
            <TagInput
              label="Skills"
              value={tags}
              onChange={setTags}
              placeholder="Add a skill and press Enter"
              maxTags={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* RuleEditor */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">RuleEditor</CardTitle>
          <CardDescription>Visual condition builder for creating filter rules.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-2xl">
            <RuleEditor
              value={rules}
              onChange={setRules}
              fields={ruleFields}
            />
          </div>
        </CardContent>
      </Card>

      {/* JsonEditor */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">JsonEditor</CardTitle>
          <CardDescription>Validated JSON editor with formatting support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xl">
            <JsonEditor
              label="Dimension Config"
              value={json}
              onChange={setJson}
              description="Configure dimension scoring thresholds"
              rows={8}
            />
          </div>
        </CardContent>
      </Card>

      {/* CodeBlock */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">CodeBlock</CardTitle>
          <CardDescription>Styled code display with optional line numbers and copy button.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">With Line Numbers</h4>
              <CodeBlock
                code={sampleCode}
                language="typescript"
                title="analyze.ts"
                showLineNumbers
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Simple</h4>
              <CodeBlock
                code={`npm install @contextor/cli
npx contextor init <your-token>`}
                language="bash"
                title="Installation"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
