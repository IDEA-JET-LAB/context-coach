import React from "react";

interface CommandsPanelProps {
  onRunCommand: (command: string) => void;
}

interface CommandButton {
  command: string;
  label: string;
  description?: string;
  isCustom?: boolean;
}

interface CommandGroup {
  title: string;
  commands: CommandButton[];
}

const commandGroups: CommandGroup[] = [
  {
    title: "System",
    commands: [
      { command: "/clear", label: "Clear", description: "Clear conversation" },
      { command: "/context", label: "Context", description: "Show context info" },
      { command: "/memory", label: "Memory", description: "Show memory files" },
      { command: "/mcp", label: "MCP", description: "Show MCP tools" },
      { command: "/skills", label: "Skills", description: "Show available skills" },
      { command: "/help", label: "Help", description: "Show help" },
    ],
  },
  {
    title: "BMAD Core",
    commands: [
      { command: "/bmad:core:agents:bmad-master", label: "BMAD Master" },
      { command: "/bmad:core:workflows:brainstorming", label: "Brainstorming" },
      { command: "/bmad:core:workflows:party-mode", label: "Party Mode" },
    ],
  },
  {
    title: "BMAD Agents",
    commands: [
      // Method agents
      { command: "/bmad:bmm:agents:analyst", label: "Analyst" },
      { command: "/bmad:bmm:agents:architect", label: "Architect" },
      { command: "/bmad:bmm:agents:dev", label: "Dev" },
      { command: "/bmad:bmm:agents:pm", label: "PM" },
      { command: "/bmad:bmm:agents:sm", label: "SM" },
      { command: "/bmad:bmm:agents:tea", label: "TEA" },
      { command: "/bmad:bmm:agents:tech-writer", label: "Tech Writer" },
      { command: "/bmad:bmm:agents:ux-designer", label: "UX Designer" },
      { command: "/bmad:bmm:agents:quick-flow-solo-dev", label: "Quick Flow" },
      // Creative & Innovation agents
      { command: "/bmad:cis:agents:innovation-strategist", label: "Innovation" },
      { command: "/bmad:cis:agents:creative-problem-solver", label: "Problem Solver" },
      { command: "/bmad:cis:agents:design-thinking-coach", label: "Design Thinking" },
      { command: "/bmad:cis:agents:storyteller", label: "Storyteller" },
      { command: "/bmad:cis:agents:brainstorming-coach", label: "Brainstorm Coach" },
      // Custom agents (marked with dot)
      { command: "/bmad:custom:agents:pixel", label: "Pixel", isCustom: true },
      { command: "/bmad:custom:agents:marketing-strategist", label: "Marketing", isCustom: true },
      { command: "/bmad:custom:agents:seo-specialist", label: "SEO", isCustom: true },
    ],
  },
  {
    title: "BMAD Workflows",
    commands: [
      { command: "/bmad:bmm:workflows:research", label: "Research" },
      { command: "/bmad:bmm:workflows:create-prd", label: "Create PRD" },
      { command: "/bmad:bmm:workflows:create-architecture", label: "Architecture" },
      { command: "/bmad:bmm:workflows:create-epics-and-stories", label: "Epics & Stories" },
      { command: "/bmad:bmm:workflows:sprint-planning", label: "Sprint Planning" },
      { command: "/bmad:bmm:workflows:sprint-status", label: "Sprint Status" },
      { command: "/bmad:bmm:workflows:dev-story", label: "Dev Story" },
      { command: "/bmad:bmm:workflows:quick-dev", label: "Quick Dev" },
      { command: "/bmad:bmm:workflows:code-review", label: "Code Review" },
      { command: "/bmad:bmm:workflows:retrospective", label: "Retrospective" },
    ],
  },
];

export const CommandsPanel: React.FC<CommandsPanelProps> = ({ onRunCommand }) => {
  return (
    <div className="commands-panel">
      <div className="panel-header">
        <h3>Quick Commands</h3>
        <p className="panel-description">
          Click a button to paste the command, then press Enter to run.
        </p>
      </div>

      {commandGroups.map((group) => (
        <div key={group.title} className="command-group">
          <h4 className="command-group-title">{group.title}</h4>
          <div className="command-chips">
            {group.commands.map((cmd) => (
              <button
                key={cmd.command}
                className={`command-chip ${cmd.isCustom ? "custom" : ""}`}
                onClick={() => onRunCommand(cmd.command)}
                title={cmd.description || cmd.command}
              >
                {cmd.isCustom && <span className="custom-dot" />}
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
