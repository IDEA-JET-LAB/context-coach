# Vibe Contextor - Session Notes

**Last Updated:** 2025-12-20
**Session:** Party Mode Brainstorming with full BMAD agent team

---

## Project Summary

**Vibe Contextor** is a planned browser extension sub-product of Context Coach, targeting non-technical "vibe coders" who use platforms like Lovable to build apps without coding.

### Core Concept
- Pre-submission prompt coaching (not post-hoc feedback)
- Real-time suggestions as users type prompts
- Gentle nudge modal before problematic prompts are sent
- Zero-friction installation via Chrome Web Store

### Target User
- **Maya** - Non-technical user (marketing manager, entrepreneur, creator)
- Uses Lovable to build apps without coding
- Writes vague, wish-like prompts
- Frustrated by multiple iteration cycles

---

## Documents Created

| Document | Status | Description |
|----------|--------|-------------|
| `ux-design-spec.md` | ✅ Complete | User journey, 3 core flows, wireframes, design principles |
| `lean-prd.md` | ✅ Complete | Problem hypothesis, MVP features, success metrics, GTM |
| `technical-spike.md` | ✅ Complete | Architecture, code patterns, Chrome extension manifest |

---

## Key Decisions Made

1. **Separate PRD** - Different user = different product document
2. **UX-First** - Design flows before specs
3. **Shared Architecture** - Extension is a module of Context Coach, not separate
4. **Prototype-Driven** - Technical spike + real user validation before full build
5. **Lovable First** - Single platform focus, expand later (Bolt, Replit, Cursor)
6. **Rule-Based Analysis** - No AI/LLM for MVP, pure pattern matching
7. **No Account Required** - Free tier works with local storage only

---

## Technical Approach

- **Chrome Extension** with Manifest V3
- **Content Script** injects into Lovable pages
- **MutationObserver** detects prompt textarea
- **Shadow DOM** for isolated UI overlay
- **Local Storage** for journal entries (same schema as Core)

---

## Next Steps (When Resuming)

1. [ ] Review the 3 documents created
2. [ ] Create Figma prototype based on UX spec
3. [ ] Recruit 5 vibe coders for user interviews
4. [ ] Build Week 1 prototype (minimal Chrome extension)
5. [ ] Validate on live Lovable projects
6. [ ] User test before full development

---

## File Locations

```
_bmad-output/vibe-contextor/
├── SESSION-NOTES.md          ◄── You are here
├── ux-design-spec.md         ◄── Sally's UX flows
├── lean-prd.md               ◄── John's product spec
└── technical-spike.md        ◄── Winston's technical feasibility
```

---

## Context to Resume

To continue this work, you can:
1. Read this SESSION-NOTES.md file
2. Reference the 3 main documents
3. Use `/bmad:core:workflows:party-mode` to bring back the agent team
4. Or work with individual agents as needed

**Key agents involved:**
- 🎨 Sally (UX Designer) - Owns UX spec
- 📋 John (PM) - Owns PRD
- 🏗️ Winston (Architect) - Owns technical spike
- 🧠 Carson (Brainstorming Coach) - Facilitated session
- ⚡ Victor (Innovation Strategist) - B2B/GTM insights

---

*Session saved during Party Mode on 2025-12-20*
