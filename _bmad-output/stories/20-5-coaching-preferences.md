# Story 20.5: Coaching Preferences

Status: Ready

## Story
**As a** developer using Contextor,
**I want** to configure coaching sensitivity and enable/disable coaching,
**So that** I can customize the coaching experience to match my workflow and preferences.

## Dependencies
- **Story 20.1**: Blocking Hook Implementation (reads config)
- **Story 20.2**: Fast Heuristics Engine (uses sensitivity level)
- **Epic 19**: VS Code Extension (for status bar and panel integration)

## Architecture Notes
> The coaching preferences schema defined in this story is an implementation detail that extends the high-level architecture. The database schema and local config format are specified here as they are specific to this feature and not covered in the architecture documents.

## Acceptance Criteria

1. **Given** I am on the Contextor dashboard settings page
   **When** I view the Coaching section
   **Then** I see toggles and controls for coaching preferences
   **And** current settings are displayed accurately

2. **Given** the coaching settings section
   **When** I select a coaching mode (Always Ask / Only on Low Scores / Never)
   **Then** I see a description of what each mode means
   **And** the setting is saved immediately
   **And** a confirmation appears
   **And** the change is synced to local config file

3. **Given** the coaching settings section
   **When** I change sensitivity level (Low/Medium/High)
   **Then** I see a description of what each level means
   **And** the setting is saved immediately
   **And** the change is synced to local config file
   **And** sensitivity only applies when coaching mode is "Always Ask" or "Only on Low Scores"

4. **Given** I have the CLI installed
   **When** my preferences change on the dashboard
   **Then** the next prompt submission uses the new settings
   **And** settings are stored in `~/.contextor/config.json`

5. **Given** coaching mode is set to "Never"
   **When** I submit a prompt
   **Then** the coaching hook exits immediately (no analysis)
   **And** prompts are still captured for analytics
   **And** the VS Code panel shows "Coaching Paused"

5a. **Given** coaching mode is set to "Only on Low Scores"
   **When** I submit a prompt with a high quality score
   **Then** the prompt is submitted without coaching intervention
   **And** prompts are still captured for analytics

5b. **Given** coaching mode is set to "Only on Low Scores"
   **When** I submit a prompt with a low quality score (below threshold)
   **Then** the coaching suggestion dialog appears
   **And** I can choose to improve or proceed

6. **Given** I am a new user
   **When** I install Contextor
   **Then** coaching mode is set to 'always' by default
   **And** sensitivity is set to 'medium'
   **And** I can change these in onboarding or settings

7. **Given** I am an admin of my team
   **When** I view team settings
   **Then** I can set default coaching preferences for new team members
   **And** individual members can override team defaults

## Technical Context

### File Locations
| File | Purpose |
|------|---------|
| `app/app/settings/coaching/page.tsx` | Dashboard coaching settings page |
| `app/lib/services/coaching-preferences.ts` | Server-side preference management |
| `app/app/api/settings/coaching/route.ts` | API endpoint for preferences |
| `~/.contextor/config.json` | Local config file (synced from cloud) |
| `packages/cli/src/commands/sync.ts` | CLI command to sync preferences |

### Database Schema
```sql
-- Create coaching_mode enum type
CREATE TYPE coaching_mode AS ENUM ('always', 'low_scores_only', 'never');

-- Add to existing user_settings or create new table
CREATE TABLE coaching_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coaching_mode coaching_mode DEFAULT 'always',
  sensitivity TEXT DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  low_score_threshold INTEGER DEFAULT 60 CHECK (low_score_threshold BETWEEN 0 AND 100),
  show_terminal_hints BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team defaults
CREATE TABLE team_coaching_defaults (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  coaching_mode coaching_mode DEFAULT 'always',
  sensitivity TEXT DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  low_score_threshold INTEGER DEFAULT 60 CHECK (low_score_threshold BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE coaching_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY coaching_own ON coaching_preferences FOR ALL USING (user_id = auth.uid());

ALTER TABLE team_coaching_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY coaching_team_admin ON team_coaching_defaults FOR ALL USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_coaching_defaults.team_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'admin'
  )
);
```

### Local Config Schema
```typescript
type CoachingMode = 'always' | 'low_scores_only' | 'never';

interface LocalCoachingConfig {
  coaching_mode: CoachingMode;
  sensitivity: 'low' | 'medium' | 'high';
  low_score_threshold: number;  // 0-100, default 60
  show_terminal_hints: boolean;
  last_synced: string;  // ISO 8601
}

// Full ~/.contextor/config.json
interface ContextorConfig {
  version: "1.0";
  user_id: string;
  api_key: string;
  api_endpoint: string;
  coaching: LocalCoachingConfig;
}
```

### Coaching Mode Descriptions
| Mode | Description | Behavior |
|------|-------------|----------|
| **Always** | Always show coaching (default) | Every prompt is analyzed; suggestions shown for any issues found |
| **Only on Low Scores** | Show coaching only for low-quality prompts | Prompts scoring below threshold trigger suggestions |
| **Never** | Disable coaching entirely | No analysis or suggestions; prompts captured for analytics only |

### Sensitivity Level Descriptions
| Level | Description | Behavior |
|-------|-------------|----------|
| **Low** | Only critical issues | Only 'warning' severity triggers suggestions |
| **Medium** | Balanced feedback (default) | Warnings + improvements if 2+ found |
| **High** | Maximum guidance | All issues trigger suggestions |

## Tasks / Subtasks

- [ ] **Task 1: Create Database Migration** (AC: #1, #7)
  - [ ] Create `coaching_mode` enum type
  - [ ] Create `coaching_preferences` table with coaching_mode column
  - [ ] Create `team_coaching_defaults` table with coaching_mode column
  - [ ] Add RLS policies
  - [ ] Create indexes for performance

- [ ] **Task 2: Create API Endpoint** (AC: #2, #3, #4)
  - [ ] Create `app/app/api/settings/coaching/route.ts`
  - [ ] GET: Return current preferences
  - [ ] PUT: Update preferences
  - [ ] Validate coaching_mode enum values
  - [ ] Validate sensitivity values
  - [ ] Return sync token for local config

- [ ] **Task 3: Create Settings Page Component** (AC: #1, #2, #3)
  - [ ] Create `app/app/settings/coaching/page.tsx`
  - [ ] Add radio buttons for coaching mode (Always/Low Scores Only/Never)
  - [ ] Add radio buttons for sensitivity (conditionally shown when mode != 'never')
  - [ ] Add slider for low score threshold (shown when mode = 'low_scores_only')
  - [ ] Show descriptions for each option
  - [ ] Add loading and success states

- [ ] **Task 4: Implement Config Sync** (AC: #4, #5)
  - [ ] Create sync mechanism in CLI
  - [ ] Fetch preferences from API on CLI commands
  - [ ] Write to `~/.contextor/config.json`
  - [ ] Cache preferences locally with TTL
  - [ ] Handle offline mode (use cached settings)

- [ ] **Task 5: Add Team Defaults** (AC: #7)
  - [ ] Create team settings component
  - [ ] Allow admins to set defaults
  - [ ] Apply defaults to new members
  - [ ] Show override indicator on individual settings

- [ ] **Task 6: Update Hook to Use Config** (AC: #5)
  - [ ] Read coaching_enabled from config
  - [ ] Read sensitivity from config
  - [ ] Early exit if disabled
  - [ ] Pass sensitivity to heuristics

## Dev Notes

### API Endpoint Implementation
```typescript
// app/app/api/settings/coaching/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const VALID_COACHING_MODES = ['always', 'low_scores_only', 'never'] as const;
const VALID_SENSITIVITIES = ['low', 'medium', 'high'] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('coaching_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return defaults if no preferences set
  const preferences = data || {
    coaching_mode: 'always',
    sensitivity: 'medium',
    low_score_threshold: 60,
    show_terminal_hints: false
  };

  return NextResponse.json({ preferences });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { coaching_mode, sensitivity, low_score_threshold, show_terminal_hints } = body;

  // Validate coaching_mode
  if (coaching_mode && !VALID_COACHING_MODES.includes(coaching_mode)) {
    return NextResponse.json(
      { error: 'Invalid coaching mode. Must be: always, low_scores_only, or never' },
      { status: 400 }
    );
  }

  // Validate sensitivity
  if (sensitivity && !VALID_SENSITIVITIES.includes(sensitivity)) {
    return NextResponse.json(
      { error: 'Invalid sensitivity level' },
      { status: 400 }
    );
  }

  // Validate low_score_threshold
  if (low_score_threshold !== undefined &&
      (low_score_threshold < 0 || low_score_threshold > 100)) {
    return NextResponse.json(
      { error: 'low_score_threshold must be between 0 and 100' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('coaching_preferences')
    .upsert({
      user_id: user.id,
      coaching_mode: coaching_mode ?? 'always',
      sensitivity: sensitivity ?? 'medium',
      low_score_threshold: low_score_threshold ?? 60,
      show_terminal_hints: show_terminal_hints ?? false,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}
```

### Settings Page Component
```typescript
// app/app/settings/coaching/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

type CoachingMode = 'always' | 'low_scores_only' | 'never';

const COACHING_MODE_OPTIONS = [
  {
    value: 'always' as CoachingMode,
    label: 'Always Ask',
    description: 'Show coaching suggestions for every prompt before submission.'
  },
  {
    value: 'low_scores_only' as CoachingMode,
    label: 'Only on Low Scores',
    description: 'Only show suggestions when prompt quality score is below threshold.'
  },
  {
    value: 'never' as CoachingMode,
    label: 'Never',
    description: 'Disable coaching entirely. Prompts are still captured for analytics.'
  }
];

const SENSITIVITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    description: 'Only show suggestions for critical issues like extremely vague prompts.'
  },
  {
    value: 'medium',
    label: 'Medium (Recommended)',
    description: 'Balanced feedback - warns about issues and suggests improvements when multiple are found.'
  },
  {
    value: 'high',
    label: 'High',
    description: 'Maximum guidance - shows suggestions for any potential improvement opportunity.'
  }
];

export default function CoachingSettingsPage() {
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('always');
  const [sensitivity, setSensitivity] = useState('medium');
  const [lowScoreThreshold, setLowScoreThreshold] = useState(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      const res = await fetch('/api/settings/coaching');
      const { preferences } = await res.json();
      setCoachingMode(preferences.coaching_mode);
      setSensitivity(preferences.sensitivity);
      setLowScoreThreshold(preferences.low_score_threshold);
    } finally {
      setLoading(false);
    }
  }

  async function updatePreference(key: string, value: any) {
    const res = await fetch('/api/settings/coaching', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });

    if (res.ok) {
      toast.success('Settings saved');
    } else {
      toast.error('Failed to save settings');
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Coaching Settings</h2>
        <p className="text-muted-foreground">
          Configure how Contextor provides feedback on your prompts.
        </p>
      </div>

      {/* Coaching Mode Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Coaching Mode</Label>
        <RadioGroup
          value={coachingMode}
          onValueChange={(value: CoachingMode) => {
            setCoachingMode(value);
            updatePreference('coaching_mode', value);
          }}
        >
          {COACHING_MODE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start space-x-3">
              <RadioGroupItem value={option.value} id={`mode-${option.value}`} />
              <div>
                <Label htmlFor={`mode-${option.value}`}>{option.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Low Score Threshold (shown only for low_scores_only mode) */}
      {coachingMode === 'low_scores_only' && (
        <div className="space-y-4">
          <Label className="text-base font-medium">
            Low Score Threshold: {lowScoreThreshold}
          </Label>
          <p className="text-sm text-muted-foreground">
            Prompts scoring below this threshold will trigger coaching suggestions.
          </p>
          <Slider
            value={[lowScoreThreshold]}
            onValueChange={([value]) => {
              setLowScoreThreshold(value);
            }}
            onValueCommit={([value]) => {
              updatePreference('low_score_threshold', value);
            }}
            min={0}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Sensitivity Level (shown when coaching is active) */}
      {coachingMode !== 'never' && (
        <div className="space-y-4">
          <Label className="text-base font-medium">Sensitivity Level</Label>
          <RadioGroup
            value={sensitivity}
            onValueChange={(value) => {
              setSensitivity(value);
              updatePreference('sensitivity', value);
            }}
          >
            {SENSITIVITY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={`sens-${option.value}`} />
                <div>
                  <Label htmlFor={`sens-${option.value}`}>{option.label}</Label>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
```

### CLI Sync Command
```typescript
// packages/cli/src/commands/sync.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function syncPreferences(apiKey: string, apiEndpoint: string): Promise<void> {
  const configPath = path.join(os.homedir(), '.contextor', 'config.json');

  // Fetch from API
  const response = await fetch(`${apiEndpoint}/settings/coaching`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    console.warn('Could not sync preferences, using cached settings');
    return;
  }

  const { preferences } = await response.json();

  // Read existing config
  let config: any = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // Update coaching section
  config.coaching = {
    coaching_mode: preferences.coaching_mode,
    sensitivity: preferences.sensitivity,
    low_score_threshold: preferences.low_score_threshold,
    show_terminal_hints: preferences.show_terminal_hints,
    last_synced: new Date().toISOString()
  };

  // Write back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('Preferences synced successfully');
}
```

### VS Code Status Display
Show coaching mode in status bar (requires Epic 19 VS Code Extension):
```typescript
const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
);

type CoachingMode = 'always' | 'low_scores_only' | 'never';

function updateStatusBar(mode: CoachingMode) {
  switch (mode) {
    case 'always':
      statusBarItem.text = '$(lightbulb) Coaching: Always';
      statusBarItem.tooltip = 'Contextor coaching is active for all prompts';
      break;
    case 'low_scores_only':
      statusBarItem.text = '$(lightbulb) Coaching: Low Scores';
      statusBarItem.tooltip = 'Coaching triggers only for low-quality prompts';
      break;
    case 'never':
      statusBarItem.text = '$(lightbulb-autofix) Coaching Paused';
      statusBarItem.tooltip = 'Click to enable coaching';
      statusBarItem.command = 'contextor.enableCoaching';
      break;
  }
  statusBarItem.show();
}
```


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### Completion Notes List
*To be filled by dev agent after implementation*
### Change Log
| Date | Change | Author |
|------|--------|--------|
### File List
*To be filled by dev agent - list all files created/modified*
