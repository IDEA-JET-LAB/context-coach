# Vibe Contextor - UX Design Specification

**Codename:** Vibe Contextor
**Type:** Browser Extension for Vibe Coding Platforms
**Target Platform:** Lovable (primary), extensible to Bolt, Replit, etc.
**UX Lead:** Sally (UX Designer)
**Date:** 2025-12-20
**Status:** Draft - Discovery Phase

---

## 1. Target Persona

### Maya - The Vibe Coder

| Attribute | Description |
|-----------|-------------|
| **Age** | 28-45 |
| **Role** | Marketing Manager, Entrepreneur, Creator |
| **Technical Level** | Non-technical, no coding background |
| **Motivation** | "I want to build my app idea without learning to code" |
| **Discovery** | Found Lovable through TikTok/YouTube/friend recommendation |
| **Emotional State** | Excited but anxious about "breaking things" |
| **Prompt Behavior** | Writes vague, wish-like prompts; talks to AI like a genie |

### Maya's Pain Points

1. **Vague prompts lead to wrong results** - "Make it prettier" produces unexpected changes
2. **No feedback until after execution** - Discovers problems only after AI builds wrong thing
3. **Doesn't know what "good prompts" look like** - No reference point for improvement
4. **Frustrated by iteration cycles** - Multiple back-and-forth attempts to get it right
5. **Afraid to experiment** - Fear of breaking what already works

### Maya's Goals

- Get her app working with minimal frustration
- Feel confident when writing prompts
- Learn naturally through doing, not reading docs
- Celebrate progress and improvement

---

## 2. User Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAYA'S JOURNEY WITH VIBE CONTEXTOR                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DISCOVER          INSTALL           FIRST USE         HABIT LOOP           │
│  ────────          ───────           ─────────         ──────────           │
│                                                                              │
│  Sees friend's     Clicks link       Types first       Trusts the           │
│  recommendation    from tweet        prompt in         suggestions          │
│       │                │             Lovable                │               │
│       ▼                ▼                │                   ▼               │
│  "This helped      One-click         Sees gentle       Prompt quality       │
│   her prompts!"    install           underline         improves weekly      │
│       │            (< 30 sec)            │                   │               │
│       ▼                │                 ▼                   ▼               │
│  Visits Chrome         ▼            "Hmm, what's      Gets "Prompt Pro"     │
│  Web Store         Extension         that?"            badge - shares!      │
│                    activates             │                                   │
│                    automatically         ▼                                   │
│                         │           Hovers, sees                            │
│                         ▼           suggestion                              │
│                    Sees subtle           │                                   │
│                    Vibe Contextor        ▼                                   │
│                    icon appear      "Oh! That                               │
│                                     makes sense!"                           │
│                                          │                                   │
│                                          ▼                                   │
│                                     Edits prompt,                           │
│                                     better result                           │
│                                          │                                   │
│                                          ▼                                   │
│                                     HOOKED                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey Phases Detail

#### Phase 1: Discovery (Pre-Install)
- **Touchpoint:** Social media, friend recommendation, Lovable community
- **Emotion:** Curious, slightly skeptical
- **Key Message:** "Write better prompts, get better apps"
- **Success Metric:** Click-through to Chrome Web Store

#### Phase 2: Installation (< 30 seconds)
- **Touchpoint:** Chrome Web Store
- **Emotion:** Hopeful, impatient
- **Requirements:**
  - One-click install
  - NO configuration required
  - NO account creation required for basic use
  - Automatic activation on Lovable.dev
- **Success Metric:** Install completion rate > 80%

#### Phase 3: First Value (< 60 seconds after install)
- **Touchpoint:** First prompt in Lovable
- **Emotion:** Surprised, delighted
- **Requirements:**
  - Immediate, subtle feedback on first prompt
  - Non-intrusive (no popups, no modals on first interaction)
  - Clear value without explanation needed
- **Success Metric:** User engages with first suggestion

#### Phase 4: Habit Formation (Week 1-4)
- **Touchpoint:** Ongoing prompt writing
- **Emotion:** Growing confidence
- **Requirements:**
  - Progressive disclosure of features
  - Celebration of improvement milestones
  - Prompt quality score visible but not pushy
- **Success Metric:** Weekly active usage, prompt score improvement

---

## 3. Core Interaction Flows

### Flow 1: Real-Time Typing Feedback

```
┌─────────────────────────────────────────────────────────────────┐
│  LOVABLE INTERFACE                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │  [User's Lovable Project UI]                                ││
│  │                                                              ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  Prompt Input Area                                          ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Make the button prettier                                │││
│  │  │              ~~~~~~~~                                   │││
│  │  │              [subtle wavy underline]                    │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                    [Submit] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ 💡 Vibe Contextor                    │  ◄── Appears on hover │
│  │                                      │      over underline   │
│  │ "Prettier" is subjective!            │                       │
│  │                                      │                       │
│  │ Try being specific:                  │                       │
│  │ • What color?                        │                       │
│  │ • What size?                         │                       │
│  │ • What style? (rounded, flat, etc)   │                       │
│  │                                      │                       │
│  │ Example: "Make the submit button     │                       │
│  │ larger with rounded corners and      │                       │
│  │ a blue gradient background"          │                       │
│  │                                      │                       │
│  │ [Use This Example]  [Dismiss]        │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction Rules:**
- Underline appears after 300ms pause in typing (debounced)
- Tooltip appears on hover, not automatically
- "Use This Example" inserts text, user can edit
- Dismiss hides for this session, pattern remembered
- Maximum 1 underline suggestion at a time (not overwhelming)

### Flow 2: Pre-Submit Gentle Nudge

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   User clicks "Submit" on a prompt with potential issues         │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │   ┌────────────────────────────────────────────────────┐    ││
│  │   │  💭 Quick thought before you send...               │    ││
│  │   │                                                    │    ││
│  │   │  Your prompt:                                      │    ││
│  │   │  "Fix the login"                                   │    ││
│  │   │                                                    │    ││
│  │   │  ⚡ This might be too vague                        │    ││
│  │   │                                                    │    ││
│  │   │  What specifically about login needs fixing?       │    ││
│  │   │  • Error handling?                                 │    ││
│  │   │  • Visual design?                                  │    ││
│  │   │  • Validation messages?                            │    ││
│  │   │                                                    │    ││
│  │   │  ┌────────────────────────────────────────────┐   │    ││
│  │   │  │ Fix the login error message - it should    │   │    ││
│  │   │  │ show "Invalid email" when email format is  │   │    ││
│  │   │  │ wrong                                      │   │    ││
│  │   │  └────────────────────────────────────────────┘   │    ││
│  │   │                                                    │    ││
│  │   │  [Send Improved ✨]        [Send Original →]       │    ││
│  │   │                                                    │    ││
│  │   │   ☐ Don't show for similar prompts                │    ││
│  │   └────────────────────────────────────────────────────┘    ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical UX Rules:**
1. **NEVER block** - "Send Original" is always prominent and accessible
2. **Respect autonomy** - User can always proceed without changes
3. **Learn from dismissals** - If user sends original 3x, reduce frequency
4. **One suggestion only** - Don't overwhelm with multiple issues
5. **Editable suggestion** - User can modify the improved version
6. **Remember preferences** - "Don't show for similar" actually works

### Flow 3: Prompt Score Dashboard (Sidebar)

```
┌─────────────────────────────────────────────────────────────────┐
│  LOVABLE INTERFACE                                [VC Icon ▼]   │
│  ┌───────────────────────────────────────┬─────────────────────┐│
│  │                                       │  VIBE CONTEXTOR     ││
│  │                                       │  ─────────────────  ││
│  │                                       │                     ││
│  │  [User's Lovable Project]             │  Prompt Score       ││
│  │                                       │  ★★★★☆ 4.2          ││
│  │                                       │                     ││
│  │                                       │  Today: 8 prompts   ││
│  │                                       │  ████████░░ +23%    ││
│  │                                       │                     ││
│  │                                       │  ─────────────────  ││
│  │                                       │  Recent Prompts     ││
│  │                                       │                     ││
│  │                                       │  ✓ "Add a contact   ││
│  │                                       │    form with email  ││
│  │                                       │    and message..."  ││
│  │                                       │    ★★★★★            ││
│  │                                       │                     ││
│  │                                       │  ⚡ "Make it nice"  ││
│  │                                       │    ★★☆☆☆            ││
│  │                                       │    [See suggestion] ││
│  │                                       │                     ││
│  │                                       │  ─────────────────  ││
│  │                                       │  🏆 Achievements    ││
│  │                                       │  • Clarity Champion ││
│  │                                       │  • 7-Day Streak     ││
│  │                                       │                     ││
│  └───────────────────────────────────────┴─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Sidebar Behavior:**
- Collapsed by default (icon only in corner)
- Expands on click
- Auto-collapses after 30 seconds of inactivity
- Syncs with prompt capture in real-time
- Shows improvement trends, not just raw scores

---

## 4. Progressive Disclosure Timeline

| Timeframe | Features Visible | Rationale |
|-----------|-----------------|-----------|
| **Day 1** | Subtle underlines only | Build trust, don't overwhelm |
| **Day 2-3** | + Hover tooltips with suggestions | User has seen value, ready for more |
| **Day 4-7** | + Pre-submit gentle nudge (light) | Comfortable with extension presence |
| **Week 2** | + Sidebar with prompt score | Ready for gamification |
| **Week 3+** | + Achievements, streaks, full dashboard | Habit formed, wants progress tracking |

---

## 5. Visual Design Principles

### Color Palette
- **Primary:** Soft purple (#8B5CF6) - Approachable, creative
- **Success:** Gentle green (#10B981) - Positive reinforcement
- **Warning:** Warm amber (#F59E0B) - Attention without alarm
- **Background:** Near-white (#FAFAFA) - Clean, non-intrusive

### Typography
- **Font:** System font stack (matches Lovable's feel)
- **Size:** 14px base, never smaller than 12px
- **Weight:** Regular for body, Medium for emphasis

### Tone of Voice
- **Friendly, not preachy:** "Quick thought..." not "Warning: Bad prompt"
- **Helpful, not critical:** "Try being specific" not "This is too vague"
- **Encouraging, not patronizing:** "Nice improvement!" not "Good job!"
- **Conversational:** Write like a helpful friend, not a teacher

### Animation
- **Subtle and purposeful:** Fade in (200ms), no bounces or slides
- **Micro-celebrations:** Confetti burst for achievements (optional, toggle-able)
- **Loading states:** Skeleton screens, never spinners

---

## 6. Friction Audit

| Step | Potential Friction | Mitigation |
|------|-------------------|------------|
| Discovery | "Another extension?" skepticism | Social proof, friend recommendations |
| Install | Chrome permissions warning | Minimal permissions, clear explanation |
| First use | "What is this underline?" confusion | Subtle animation draws attention |
| Tooltip | Too much text to read | Progressive disclosure, examples first |
| Pre-submit modal | Feels like interruption | "Send Original" always prominent |
| Sidebar | Takes up screen space | Collapsed by default, easy dismiss |
| Account creation | Doesn't want another login | Free tier works without account |

---

## 7. Accessibility Requirements

- **Keyboard navigation:** Full support for all interactions
- **Screen reader:** ARIA labels on all interactive elements
- **Color contrast:** WCAG AA minimum (4.5:1)
- **Reduced motion:** Respect `prefers-reduced-motion`
- **Focus indicators:** Clear, visible focus states

---

## 8. Success Metrics

### Primary Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Install completion rate | > 80% | Chrome Web Store analytics |
| First-week retention | > 40% | Extension usage analytics |
| Prompt score improvement | +20% over 30 days | Internal scoring |
| User satisfaction (NPS) | > 50 | In-extension survey |

### Secondary Metrics
- Suggestions accepted vs. dismissed ratio
- Pre-submit modal engagement rate
- Sidebar open frequency
- Achievement unlock rate

---

## 9. Open Questions for User Validation

1. **Underline sensitivity:** How many underlines before it feels annoying?
2. **Modal frequency:** How often is "acceptable" for pre-submit nudges?
3. **Scoring visibility:** Do users want to see their score, or is it demotivating?
4. **Social features:** Would users share achievements? Compare with friends?
5. **Platform priority:** After Lovable, which platform next? (Bolt, Cursor, Replit)

---

## 10. Next Steps

1. [ ] Create clickable prototype in Figma
2. [ ] Recruit 5 vibe coders for user interviews
3. [ ] Test first-use flow with think-aloud protocol
4. [ ] Validate pre-submit modal acceptance rate
5. [ ] Iterate based on feedback before development

---

*Document authored by Sally (UX Designer) during Party Mode brainstorming session.*
