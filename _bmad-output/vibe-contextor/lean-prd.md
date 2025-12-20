# Vibe Contextor - Lean PRD

**Codename:** Vibe Contextor
**Parent Product:** Context Coach
**Type:** Sub-product / Market Extension
**PM Lead:** John (Product Manager)
**Date:** 2025-12-20
**Status:** Discovery Phase

---

## Problem Hypothesis

**The vibe coding revolution has a quality problem.**

Non-technical users ("vibe coders") are building apps with AI tools like Lovable, but their prompts are often vague, ambiguous, or incomplete. This leads to:

- Multiple iteration cycles to get desired results
- Frustration and abandonment
- Perception that "AI doesn't understand me"
- Wasted compute and user time

**The root cause:** These users don't know what makes a good prompt, and they receive no feedback until AFTER the AI has already executed their request.

**Our hypothesis:** Pre-submission prompt coaching will significantly reduce iteration cycles and increase user satisfaction for vibe coders.

---

## Target User

### Primary: Maya - The Vibe Coder

| Attribute | Value |
|-----------|-------|
| Technical skill | Non-technical, no coding experience |
| Platform | Lovable (primary) |
| Goal | Build her app idea without learning to code |
| Behavior | Writes prompts like wishes; vague and hopeful |
| Pain | Multiple failed iterations before getting it right |
| Willingness to pay | $5-15/month for tools that save time |

### Why Lovable First?

1. **Market leader** in vibe coding space
2. **Web-based** (browser extension is viable)
3. **Active community** for distribution
4. **Clear prompt input pattern** (single textarea)

---

## Value Proposition

> **Write better prompts. Build better apps. Less frustration.**

Vibe Contextor is a browser extension that coaches you in real-time as you write prompts in Lovable. Get gentle suggestions BEFORE you hit submit, so you waste less time on failed iterations.

### Key Differentiators

| Current State | Vibe Contextor |
|--------------|----------------|
| Feedback after execution | Feedback before submission |
| Learn through trial and error | Learn through guided suggestions |
| No visibility into prompt quality | Prompt score and improvement trends |
| Generic AI tools | Purpose-built for vibe coding |

---

## MVP Feature Set

### Must Have (P0) - Launch Blockers

| Feature | Description | UX Reference |
|---------|-------------|--------------|
| **Real-time underlines** | Subtle visual indicators on vague/problematic text | Flow 1 in UX Spec |
| **Hover suggestions** | Tooltip with specific improvement suggestions | Flow 1 in UX Spec |
| **Pre-submit nudge** | Optional modal before sending problematic prompts | Flow 2 in UX Spec |
| **Prompt capture** | Save all prompts to local storage for analysis | Shared with Core |
| **One-click install** | Chrome Web Store, no config required | Journey Phase 2 |

### Should Have (P1) - Fast Follow

| Feature | Description | UX Reference |
|---------|-------------|--------------|
| **Prompt score** | 1-5 star rating visible after each prompt | Flow 3 in UX Spec |
| **Improvement trends** | Weekly progress visualization | Flow 3 in UX Spec |
| **Example library** | Searchable good prompt examples | Future enhancement |

### Nice to Have (P2) - Future

| Feature | Description |
|---------|-------------|
| Achievements/gamification | Badges, streaks, celebrations |
| Team features | Share prompt patterns across team |
| Multi-platform support | Bolt, Cursor, Replit integration |
| Cloud sync | Sync prompts across devices |
| AI-powered suggestions | Custom suggestions using LLM |

---

## Success Criteria

### Prototype Validation (Before Development)

| Metric | Target | Method |
|--------|--------|--------|
| User interviews completed | 5+ vibe coders | Recruitment from Lovable Discord |
| Concept resonance | 4/5 say "I would use this" | Post-interview survey |
| Willingness to install | 3/5 would install immediately | Direct ask |
| Feature priority alignment | Top 2 features match our P0 | Card sorting exercise |

### MVP Launch Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Chrome Web Store installs | 500 | First 30 days |
| Weekly active users | 200 | After 30 days |
| Suggestion acceptance rate | > 30% | Ongoing |
| User retention (week 1) | > 40% | First 30 days |
| NPS score | > 40 | Survey at day 14 |

### Business Validation

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Prompt quality improvement | +25% score over 30 days | Per-user tracking |
| User testimonials | 10 shareable quotes | First 60 days |
| Lovable community mentions | 20+ organic mentions | First 60 days |
| B2B interest signals | 2+ platform inquiries | First 90 days |

---

## Technical Constraints

| Constraint | Implication |
|------------|-------------|
| Browser extension only | No server-side processing for MVP |
| Lovable DOM dependency | Must monitor for UI changes |
| No account required | Local storage for free tier |
| Privacy-first | Prompts stay local unless user opts in |

See **Technical Spike** document for detailed feasibility analysis.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lovable changes DOM structure | Medium | High | MutationObserver pattern, quick patch process |
| Users find suggestions annoying | Medium | High | Progressive disclosure, easy dismissal |
| Chrome rejects extension | Low | High | Follow all store policies, minimal permissions |
| Low discoverability | High | Medium | Community marketing, influencer outreach |
| Lovable builds similar feature | Medium | High | Move fast, establish user base, pivot to B2B |

---

## Go-to-Market Strategy

### Phase 1: Validation (Weeks 1-2)
- Build clickable prototype
- Interview 5-10 Lovable users
- Post in Lovable Discord for feedback
- Refine based on learnings

### Phase 2: MVP Development (Weeks 3-6)
- Build Chrome extension with P0 features
- Internal testing with team
- Beta with 20 users from interviews

### Phase 3: Launch (Week 7+)
- Chrome Web Store publication
- Lovable community announcement
- Twitter/X launch thread
- Product Hunt submission

### Distribution Channels
1. **Lovable Discord** - Primary community
2. **Twitter/X** - Vibe coding influencers
3. **YouTube** - Tutorial creators
4. **Product Hunt** - Launch visibility
5. **Chrome Web Store** - Organic discovery

---

## Competitive Landscape

| Competitor | Approach | Gap |
|------------|----------|-----|
| Lovable native | No prompt coaching exists | Full gap |
| Grammarly | Writing, not prompts | Domain gap |
| PromptPerfect | Generic prompt optimization | Not vibe-coding specific |
| Cursor/Copilot | Technical users only | Audience gap |

**Our wedge:** First purpose-built prompt coach for non-technical vibe coders.

---

## Open Questions

1. **Pricing model:** Freemium vs. paid-only vs. pay-what-you-want?
2. **B2B angle:** Should we approach Lovable for partnership before launch?
3. **AI suggestions:** Use LLM for suggestions (cost) or rule-based (limited)?
4. **Data collection:** What anonymized data helps us improve without privacy concerns?

---

## Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| UX Design Spec | Sally (UX) | Complete |
| Technical Spike | Winston (Architect) | In Progress |
| Core Context Coach schema | Team | Stable (v1.1) |
| Chrome developer account | Edgars | TBD |

---

## Appendix: User Interview Script

### Screening Questions
1. Have you used Lovable in the past month?
2. How many projects have you built with it?
3. On a scale of 1-10, how confident are you writing prompts?

### Core Questions
1. Walk me through your last Lovable session. What worked? What frustrated you?
2. When a prompt doesn't work, what do you do?
3. How do you know if a prompt is "good" before you send it?
4. If a tool could help you write better prompts, what would it do?
5. Would you install a browser extension for this? Why or why not?

### Closing
1. What would make you tell a friend about this tool?
2. Any features we didn't mention that you'd want?

---

*Document authored by John (Product Manager) during Party Mode brainstorming session.*
