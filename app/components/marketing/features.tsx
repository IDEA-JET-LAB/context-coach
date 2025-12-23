import { Zap, BrainCircuit, Users } from 'lucide-react';

const features = [
  {
    icon: Zap,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    title: 'Automatic Capture',
    description:
      'Seamlessly integrates with your existing AI tools to capture prompts as they happen without breaking flow.',
  },
  {
    icon: BrainCircuit,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10',
    title: 'AI-Powered Analysis',
    description:
      'Instant scoring across context, clarity, and structure dimensions with actionable suggestions for improvement.',
  },
  {
    icon: Users,
    iconColor: 'text-info',
    iconBg: 'bg-info/10',
    title: 'Team Insights',
    description:
      "Track your team's velocity and prompt quality over time. Identify top performers and coaching opportunities.",
  },
];

export function MarketingFeatures() {
  return (
    <section id="features" className="bg-background border-t border-border py-24">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="p-6 rounded-2xl bg-card border border-border"
          >
            <div
              className={`w-10 h-10 rounded-lg ${feature.iconBg} flex items-center justify-center mb-4`}
            >
              <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {feature.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
