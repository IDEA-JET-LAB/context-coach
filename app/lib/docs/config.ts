import {
  Rocket,
  Terminal,
  BarChart3,
  Users,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';

export interface DocSection {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const docSections: DocSection[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of Contextor and how to set up your first project.',
    icon: Rocket,
  },
  {
    slug: 'cli-installation',
    title: 'CLI Installation',
    description: 'Install and configure the Contextor CLI for prompt capture.',
    icon: Terminal,
  },
  {
    slug: 'understanding-scores',
    title: 'Understanding Scores',
    description: 'Learn how prompt scores are calculated and what they mean.',
    icon: BarChart3,
  },
  {
    slug: 'team-management',
    title: 'Team Management',
    description: 'Manage your team members, roles, and permissions.',
    icon: Users,
  },
  {
    slug: 'faq',
    title: 'FAQ',
    description: 'Frequently asked questions about Contextor.',
    icon: HelpCircle,
  },
];

export function getDocSection(slug: string): DocSection | undefined {
  return docSections.find((section) => section.slug === slug);
}

export function isValidDocSlug(slug: string): boolean {
  return docSections.some((section) => section.slug === slug);
}
