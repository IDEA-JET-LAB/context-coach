'use client';

import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  HelpCircle,
  BookOpen,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ExternalLink,
  Play,
  Sparkles,
  FileText,
  Scale,
  Settings2,
  Beaker,
  Filter,
  History,
  Building2,
} from 'lucide-react';

/**
 * Contextual Help Components
 *
 * Provides:
 * - Contextual help tooltips
 * - Documentation sidebar panel
 * - Onboarding tour for first-time admins
 * - Example templates and presets
 */

// Help content for different sections
const HELP_CONTENT = {
  prompts: {
    title: 'Prompt Templates',
    description: 'Define how the AI analyzes prompts',
    icon: FileText,
    content: `
Prompt templates are the instructions given to the AI for analyzing user prompts.
They use variables like {{prompt}}, {{context}}, and {{history}} to inject dynamic content.

**Best Practices:**
- Be specific about what you want the AI to evaluate
- Include examples of good and bad prompts
- Define clear scoring criteria
- Test templates before publishing
    `,
    tips: [
      'Use {{prompt}} to reference the user\'s input',
      'Include scoring rubrics for consistency',
      'Test with edge cases before publishing',
    ],
  },
  weights: {
    title: 'Scoring Weights',
    description: 'Configure how dimensions contribute to scores',
    icon: Scale,
    content: `
Scoring weights determine how much each dimension contributes to the overall prompt score.
Weights must sum to 100%.

**Dimension Types:**
- **Clarity**: How clear and unambiguous the prompt is
- **Context**: How well background information is provided
- **Specificity**: How detailed the requirements are
- **Goal**: How well the desired outcome is defined
- **Constraints**: How well limitations are specified
    `,
    tips: [
      'Weights must sum to 100%',
      'Use presets as starting points',
      'Consider team-specific overrides for different use cases',
    ],
  },
  rules: {
    title: 'Classification Rules',
    description: 'Automate prompt categorization',
    icon: Filter,
    content: `
Classification rules automatically categorize prompts based on patterns.
Rules are evaluated in priority order, and the first match wins.

**Condition Types:**
- **Regex**: Match using regular expressions
- **Keyword**: Match specific words or phrases
- **Score Threshold**: Trigger based on score values
- **Length Check**: Based on prompt character count

**Actions:**
- Classify with a label
- Adjust scores up or down
- Flag for review
- Apply specific templates
    `,
    tips: [
      'Test rules with sample prompts before enabling',
      'Use priority to control evaluation order',
      'Start with simple keyword rules',
    ],
  },
  experiments: {
    title: 'A/B Testing',
    description: 'Test configuration changes scientifically',
    icon: Beaker,
    content: `
A/B experiments let you test different configurations with a portion of users
to measure their impact before rolling out to everyone.

**Key Concepts:**
- **Control**: The current/baseline configuration
- **Treatment**: The new configuration being tested
- **Statistical Significance**: Confidence that results aren't random
- **Sample Size**: Number of observations needed

**Best Practices:**
1. Define a clear hypothesis
2. Run experiments long enough to reach significance
3. Test one change at a time
4. Monitor for unexpected effects
    `,
    tips: [
      'Wait for 95% confidence before declaring winners',
      'Start with 50/50 traffic splits',
      'Run experiments for at least 2 weeks',
    ],
  },
  versions: {
    title: 'Version Control',
    description: 'Track and manage configuration changes',
    icon: History,
    content: `
Version control keeps a history of all configuration changes,
allowing you to track who changed what and when.

**Features:**
- Full change history with timestamps
- Side-by-side version comparison
- Rollback to previous versions
- Version tagging for releases
    `,
    tips: [
      'Tag important versions (e.g., "production", "stable")',
      'Review diffs before rolling back',
      'Document major changes in descriptions',
    ],
  },
  teams: {
    title: 'Team Overrides',
    description: 'Customize settings per team',
    icon: Building2,
    content: `
Team overrides let you customize scoring weights for specific teams
without affecting other users.

**Use Cases:**
- Different scoring priorities for different departments
- Testing new weights with a pilot team
- Accommodating team-specific workflows
    `,
    tips: [
      'Start with defaults and override only when needed',
      'Document why teams have different settings',
      'Review overrides periodically',
    ],
  },
} as const;

type HelpSection = keyof typeof HELP_CONTENT;

// Tour steps for onboarding
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Admin Configuration',
    description: 'Learn how to configure the analysis engine for your organization.',
    target: null,
  },
  {
    id: 'prompts',
    title: 'Prompt Templates',
    description: 'Start by reviewing or customizing the AI prompt templates used for analysis.',
    target: 'prompts-tab',
  },
  {
    id: 'weights',
    title: 'Scoring Weights',
    description: 'Adjust how different dimensions contribute to the overall score.',
    target: 'weights-tab',
  },
  {
    id: 'experiments',
    title: 'A/B Testing',
    description: 'Test configuration changes with controlled experiments before rolling out.',
    target: 'experiments-tab',
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    description: 'Track all configuration changes for compliance and debugging.',
    target: 'audit-tab',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You can access this help anytime by clicking the help icon.',
    target: null,
  },
] as const;

// Context for managing tour state
interface TourContextType {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

// Tour Provider
interface TourProviderProps {
  children: ReactNode;
  onComplete?: () => void;
}

export function TourProvider({ children, onComplete }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startTour = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    onComplete?.();
  }, [onComplete]);

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  return (
    <TourContext.Provider
      value={{ isActive, currentStep, startTour, endTour, nextStep, prevStep }}
    >
      {children}
      {isActive && <TourOverlay />}
    </TourContext.Provider>
  );
}

// Tour Overlay Component
function TourOverlay() {
  const { currentStep, nextStep, prevStep, endTour } = useTour();
  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  if (!step) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />

      {/* Tour Card */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
        <Card className="w-[400px] shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </Badge>
              <Button variant="ghost" size="sm" onClick={endTour}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="mt-2">{step.title}</CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress dots */}
            <div className="flex justify-center gap-1 mb-4">
              {ONBOARDING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    i === currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={isFirstStep}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {isLastStep ? (
                <Button onClick={endTour} className="bg-green-600 hover:bg-green-700">
                  <Check className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              ) : (
                <Button onClick={nextStep}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Help Tooltip Component
interface HelpTooltipProps {
  section: HelpSection;
  children?: ReactNode;
  className?: string;
}

export function HelpTooltip({ section, children, className }: HelpTooltipProps) {
  const content = HELP_CONTENT[section];
  const Icon = content.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button className={cn('text-muted-foreground hover:text-foreground', className)}>
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{content.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">{content.description}</p>
            {content.tips[0] && (
              <div className="flex items-start gap-2 text-xs">
                <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5" />
                <span>{content.tips[0]}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Help Popover (more detailed)
interface HelpPopoverProps {
  section: HelpSection;
  children?: ReactNode;
  className?: string;
}

export function HelpPopover({ section, children, className }: HelpPopoverProps) {
  const content = HELP_CONTENT[section];
  const Icon = content.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className={className}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{content.title}</h4>
              <p className="text-xs text-muted-foreground">{content.description}</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground whitespace-pre-line">
            {content.content.trim()}
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-medium text-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500" />
              Tips
            </h5>
            <ul className="space-y-1">
              {content.tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">-</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Documentation Sidebar
interface DocumentationSidebarProps {
  defaultSection?: HelpSection;
}

export function DocumentationSidebar({ defaultSection }: DocumentationSidebarProps) {
  const [activeSection, setActiveSection] = useState<HelpSection | null>(
    defaultSection || null
  );

  const sections = Object.entries(HELP_CONTENT) as [HelpSection, typeof HELP_CONTENT[HelpSection]][];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-2 h-4 w-4" />
          Documentation
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Admin Documentation</SheetTitle>
          <SheetDescription>
            Learn how to configure the analysis engine
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Section Navigation */}
          <div className="flex flex-wrap gap-2">
            {sections.map(([key, content]) => {
              const Icon = content.icon;
              return (
                <Button
                  key={key}
                  variant={activeSection === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveSection(key)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {content.title}
                </Button>
              );
            })}
          </div>

          {/* Active Section Content */}
          {activeSection && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {(() => {
                    const Icon = HELP_CONTENT[activeSection].icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {HELP_CONTENT[activeSection].title}
                </CardTitle>
                <CardDescription>
                  {HELP_CONTENT[activeSection].description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {HELP_CONTENT[activeSection].content.trim()}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <h5 className="text-sm font-medium text-amber-500 flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4" />
                    Pro Tips
                  </h5>
                  <ul className="space-y-1">
                    {HELP_CONTENT[activeSection].tips.map((tip, i) => (
                      <li
                        key={i}
                        className="text-sm text-amber-500/80 flex items-start gap-2"
                      >
                        <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {!activeSection && (
            <div className="text-center py-12 text-muted-foreground">
              Select a section above to view documentation
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Quick Start Button (triggers tour)
interface QuickStartButtonProps {
  className?: string;
}

export function QuickStartButton({ className }: QuickStartButtonProps) {
  const [showStartDialog, setShowStartDialog] = useState(false);

  return (
    <TourProvider onComplete={() => setShowStartDialog(false)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowStartDialog(true)}
        className={className}
      >
        <Play className="mr-2 h-4 w-4" />
        Quick Start Tour
      </Button>

      {showStartDialog && <TourStartDialog onClose={() => setShowStartDialog(false)} />}
    </TourProvider>
  );
}

function TourStartDialog({ onClose }: { onClose: () => void }) {
  const { startTour } = useTour();

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={onClose} />
      <Card className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px]">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center">Welcome to Admin Configuration</CardTitle>
          <CardDescription className="text-center">
            Take a quick tour to learn how to configure the analysis engine for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={startTour} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            Start Tour
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

// Example Templates Section
export function ExampleTemplates() {
  const templates = [
    {
      id: 'clarity-focused',
      name: 'Clarity Focused',
      description: 'Emphasizes clear and unambiguous communication',
      category: 'General',
    },
    {
      id: 'technical',
      name: 'Technical Deep-Dive',
      description: 'Best for code and technical documentation prompts',
      category: 'Engineering',
    },
    {
      id: 'creative',
      name: 'Creative Writing',
      description: 'Optimized for creative and open-ended prompts',
      category: 'Content',
    },
    {
      id: 'enterprise',
      name: 'Enterprise Standard',
      description: 'Balanced approach for business communications',
      category: 'Business',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground">Example Templates</h4>
        <Button variant="ghost" size="sm">
          View All
          <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{template.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {template.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{template.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Help Button with integrated features
interface HelpButtonProps {
  section?: HelpSection;
  showTour?: boolean;
  showDocs?: boolean;
  className?: string;
}

export function HelpButton({
  section,
  showTour = true,
  showDocs = true,
  className,
}: HelpButtonProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {section && <HelpPopover section={section} />}
      {showDocs && <DocumentationSidebar defaultSection={section} />}
      {showTour && <QuickStartButton />}
    </div>
  );
}
