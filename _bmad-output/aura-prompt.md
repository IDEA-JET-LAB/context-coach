# Aura Prompt: Contextor Dashboard

## Project Overview

Build a **developer analytics dashboard** called "Contextor" (tagline: "Your Context Tutor") that helps development teams improve their AI prompting skills. The app captures prompts from AI coding tools, scores them across 5 dimensions, and provides coaching feedback.

**Domain:** contextor.co

---

## Design System

### Color Palette (Dark Mode)

**Base Colors:**
- Background: `#0a0a0a` (near-black)
- Surface/Cards default: `#141414` (dark gray)
- Borders/Dividers: `#27272a` (charcoal)
- Primary text: `#fafafa` (white)
- Secondary text: `#a1a1aa` (gray)

**Score Colors (for prompt list accents, badges, and progress indicators):**
- High scores (7-10): Teal `#14b8a6` / gradient to `#0d9488`
- Medium scores (4-6): Amber `#f59e0b` / gradient to `#d97706`
- Growth opportunity (1-3): Coral `#f87171` / gradient to `#ef4444`

**Accents:**
- Primary (buttons, links): Teal `#14b8a6`
- Secondary (badges): Violet `#8b5cf6`
- Info: Sky blue `#38bdf8`

### Typography

- Font: Inter (Google Fonts)
- Headings: Semibold/Bold
- Body: 14px Regular
- Metrics/Scores: 32px Bold
- Small/Captions: 12px

### Spacing & Radius

- Base spacing unit: 8px
- Card border-radius: 16px (large, rounded)
- Button border-radius: 6px
- Generous whitespace between elements

---

## Layout Structure

### Sidebar (64px wide, icon-only)
Fixed left sidebar with icon navigation:
1. Feed icon (grid/list) - active state
2. Analytics icon (chart)
3. Team icon (people)
4. Projects icon (folder)
5. Settings icon (gear) - at bottom

Active icon: Teal background with white icon
Inactive: Gray icon, hover shows subtle background

### Main Content Area
- Max-width: 1200px, centered
- Padding: 24px
- Header with title + stats + action button
- Filter bar below header
- Full-width list layout for prompts (not card grid)

---

## Screens to Build

### Screen 1: Landing Page (Marketing)

Single-page marketing site for contextor.co

**Navigation Bar (sticky top):**
- Left: Contextor logo + wordmark
- Center: Nav links: "Features", "Pricing", "Docs" (scroll anchors or placeholder)
- Right: "Log In" button (ghost) + "Sign Up" button (teal primary)

**Hero Section:**
- Large headline: "Your Context Tutor"
- Subheadline: "Help your team master AI prompting. Capture, analyze, and improve every prompt."
- CTA buttons: "Get Started Free" (teal) + "See Demo" (secondary)
- Hero image/illustration: Stylized dashboard preview or abstract visualization

**Features Section (3-column grid):**
1. "Automatic Capture" - Icon + brief description
2. "AI-Powered Analysis" - Icon + brief description
3. "Team Insights" - Icon + brief description

**Social Proof Section:**
- "Trusted by development teams" with placeholder logos or testimonial quotes

**Footer:**
- Links: Privacy, Terms, Contact
- Copyright: © 2025 Contextor

---

### Screen 2: Login Page

**Layout:** Centered card on dark background

**Login Card (max-width 400px, centered):**
- Contextor logo at top
- Heading: "Welcome back"
- Subheading: "Sign in to your account"

**Form Fields:**
- Email input field
- Password input field
- "Forgot password?" link (right-aligned, small)

**Actions:**
- "Sign In" button (full width, teal primary)
- Divider: "or continue with"
- "Sign in with Google" button (full width, secondary with Google icon)

**Footer text:**
- "Don't have an account? Sign up" (link to signup)

---

### Screen 3: Prompt Feed (Main Dashboard)

**Header:**
- Left: Page title "Prompt Feed"
- Right: Stats showing "7.2 Avg Score" with "+14% this week" in teal, and a "New Project" button

**Filter Bar:**
Row of filter buttons: "All Prompts" (active), "My Prompts", "High Scores", "Growth Opportunities"

**Prompt List (NOT cards - full-width list view):**
Each prompt is a full-width row. Stack vertically, one per line.

**Prompt Row Structure:**
- Left edge: Vertical color accent bar (4px wide) showing score color (teal/amber/coral)
- Row content (horizontal layout):
  - **Score badge**: Large "8.5" in a circular or rounded badge with score color background
  - **Main content area** (flex, takes most width):
    - **Top line**: Source badge ("CLAUDE CODE" pill) + Timestamp ("Dec 19, 2:34 PM") + User avatar with initial
    - **Prompt text**: 2-3 lines of the actual prompt text, truncated with "..." if longer. Use regular font (not monospace). Gray/white text. This is the main focus of the row.
  - **Right edge**: Trend indicator ("+0.8 ↑" in small teal text) + "..." menu icon

**Sample Prompt Rows (create 5-6):**

1. **Teal (8.5)**: "I need to implement user authentication middleware for our Next.js API routes. The middleware should check for a valid JWT token in the Authorization header, validate it against our Supabase auth, and add the user object to the request context..."
   - CLAUDE CODE • Dec 19, 2:34 PM • User E • +0.8

2. **Teal (7.8)**: "Add validation to the user registration form. Check that email is valid format, password is at least 8 characters with one number, and username is unique. Show inline errors..."
   - BMAD • Dec 19, 1:15 PM • User E • +0.3

3. **Amber (5.2)**: "Fix the database connection issue that happens when too many users connect at once. I think it's a pool problem..."
   - CLAUDE CODE • Dec 19, 11:42 AM • User M • +1.2

4. **Amber (4.9)**: "Update the API endpoint for getting user data"
   - BMAD • Dec 18, 4:30 PM • User M • -0.2

5. **Coral (2.8)**: "Make it work"
   - CLAUDE CODE • Dec 18, 3:55 PM • User M • +0.5

6. **Teal (9.1)**: "Refactor the authentication flow to use a centralized auth context. Currently we have duplicate auth checks in /pages/dashboard, /pages/settings, and /pages/profile. Create a single AuthProvider component that wraps the app..."
   - CLAUDE CODE • Dec 18, 10:20 AM • User S • +0.1

---

### Screen 4: Prompt Detail (Analysis View)

When a prompt row is clicked, show detail view. Can be a modal or separate page.

**Header:**
- Back arrow + "Prompt Details"
- Right side: Large score badge showing "8.5/10" in teal

**Content Layout: Two-column (2/3 + 1/3 split)**

**Left Column (2/3 width) - Prompt Text:**
- Section heading: "Prompt"
- Full prompt text in a card with dark surface background
- Use monospace font for the prompt text
- Full text visible, no truncation
- Generous padding and line height for readability

Example prompt (full text):
```
I need to implement user authentication middleware for our Next.js API routes. The middleware should check for a valid JWT token in the Authorization header, validate it against our Supabase auth, and add the user object to the request context.

Requirements:
- Check Authorization header exists
- Validate JWT token format
- Verify against Supabase auth.getUser()
- Add user to request context
- Return 401 for invalid/missing tokens

Reference the existing /lib/auth/session.ts for patterns.
```

**Right Column (1/3 width) - Analysis Panel:**

**Dimension Breakdown (compact circular indicators):**
5 circular progress rings stacked vertically, each showing:
- Circular progress indicator (ring that fills based on score, colored by score range)
- Dimension name to the right of circle
- Score number (e.g., "8.5")

Layout per dimension:
```
[○ filled ring] Context         8.5
[○ filled ring] Clarity         9.0
[○ filled ring] Specificity     6.2
[○ filled ring] Security       10.0
[○ filled ring] Structure       5.5
```

Ring colors: Teal for 7+, Amber for 4-6, Coral for 1-3

**Suggestions Section (below dimensions):**
- Section heading: "Suggestions"
- Bullet list with improvement tips:
  - "Consider breaking down the implementation into smaller steps"
  - "Good file reference! This helps the AI understand existing patterns"
  - "Could specify expected error handling behavior"

**Metadata (small, at bottom):**
- Source: CLAUDE CODE
- Captured: Dec 19, 2024 at 2:34 PM
- User: Edgars

---

### Screen 5: Analytics Overview

**Header:**
- Title: "Analytics"
- Date range selector (dropdown: "Last 7 days", "Last 30 days", etc.)

**Stats Row:**
4 stat cards in a row:
1. "Average Score" - 7.2 - "+0.8 from last week" (teal accent)
2. "Total Prompts" - 156 - "This month"
3. "Improvement" - "+23%" - "Score trend"
4. "Top Dimension" - "Clarity" - "9.1 avg"

**Charts Section:**
1. **Score Trend Chart**
   Line chart showing score over time (use placeholder or simple SVG)
   X-axis: dates, Y-axis: score 0-10
   Line color: teal

2. **Dimension Comparison**
   Horizontal bar chart comparing avg scores per dimension
   Use appropriate colors (teal for high, amber for medium)

**Team Breakdown (if team view):**
Table or card list showing team members:
| User | Prompts | Avg Score | Trend |
| Edgars | 45 | 8.2 | +1.2 |
| Martins | 38 | 5.4 | +2.1 |
| Sofia | 73 | 7.8 | +0.3 |

---

### Screen 6: Team Management

**Header:**
- Title: "Team"
- "Invite Member" button (teal)

**Team Info Card:**
- Team name: "Acme Development"
- Members: 3
- Created: Dec 2024

**Members List:**
Card for each member:
- Avatar + Name + Email
- Role badge ("Admin" or "Member")
- "..." menu for actions

**Pending Invitations:**
Section showing pending invites with "Resend" and "Cancel" options

---

## Component Specifications

### Buttons
- Primary: Teal background, white text, 6px radius
- Secondary: Transparent with border, gray text
- Ghost: No background, text only

### Input Fields
- Dark surface background (#141414)
- Border: #27272a
- Focus: Teal border
- Placeholder: Gray text

### Badges/Pills
- Small rounded pill shape
- Semi-transparent backgrounds
- Used for: source labels, role indicators, status

### Avatar
- Circular, 32px default
- Background: Surface color
- Text: User initial, bold

### Cards
- Background: Surface color (#141414) for default cards
- Border-radius: 16px
- Padding: 24px
- No visible border (or very subtle)
- Used for: login form, stat blocks, prompt detail sections, settings panels
- NOT used for prompt list (those are full-width rows with accent bars)

### Prompt List Rows
- Full-width rows on dark background
- Left edge: 4px vertical accent bar (score color)
- Circular score badge with score color background
- Hover state: subtle background highlight
- Padding: 16px vertical, 24px horizontal

### Tooltips
- Dark background (#27272a)
- White text
- Small arrow pointing to trigger

---

## Responsive Behavior

- Desktop: Full sidebar + multi-column card grid
- Tablet (< 1024px): Collapsible sidebar, 2-column grid
- Mobile (< 768px): Bottom nav or hamburger menu, single column

---

## Important UX Notes

1. **Growth mindset framing:** Never use "bad" or "failing" - use "growth opportunity"
2. **Color meaning:** Teal = success/high, Amber = learning/medium, Coral = opportunity/growth
3. **Progressive disclosure:** List rows show truncated prompts, click for full analysis
4. **Real-time feel:** Design should feel live and dynamic
5. **Developer aesthetic:** Clean, efficient, minimal chrome
6. **Prompt-first design:** The actual prompt text is the star — always visible, never hidden behind a title

---

## Deliverables

Please create:
1. **Landing Page** - Marketing page with hero, features, and sign-up CTA
2. **Login Page** - Authentication form with email/password and Google sign-in
3. **Prompt Feed** - Main dashboard with full-width prompt list (not card grid)
4. **Prompt Detail** - Analysis view with 2/3 prompt text + 1/3 analysis panel
5. **Analytics** - Charts and stats view
6. **Team** - Team management view

Make it feel like a premium developer tool - clean, fast, professional but with personality through the vibrant score colors.
