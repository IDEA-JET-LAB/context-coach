# Epic: Vibe Contextor Validation Prototype

**Epic ID:** VC-PROTO-001
**Type:** Technical Validation / Spike
**Created:** 2025-12-20
**Owner:** Winston (Architect)
**Status:** In Progress

---

## Objective

Build a minimal Chrome extension that proves the core technical hypothesis:
> We can intercept prompts in Lovable's editor, display them in a sidebar for editing, and relay the (optionally modified) prompt back to Lovable.

**This is NOT a product build.** This is a quick validation to de-risk the architecture before investing in full development.

---

## Success Criteria

- [ ] Extension loads on lovable.dev without errors
- [ ] Sidebar appears when user clicks extension icon or submits a prompt
- [ ] Prompt text is captured and displayed in editable textarea
- [ ] "Send" button submits the prompt to Lovable
- [ ] "Cancel" button dismisses sidebar without action
- [ ] Basic logging to console for debugging

---

## Scope

### In Scope
- Chrome extension with Manifest V3
- Content script for lovable.dev
- Collapsible sidebar UI (fixed right edge)
- Submit interception (button click + Enter key)
- Basic prompt relay back to Lovable

### Out of Scope (Future)
- Prompt analysis / suggestions
- Scoring system
- Storage / journal
- Multiple platform support
- Polish / animations
- Error handling edge cases

---

## Technical Approach

```
┌──────────────────────────────────────────────────────────────┐
│                    LOVABLE PAGE                               │
│  ┌────────────────────────────────┐  ┌────────────────────┐ │
│  │                                │  │  SIDEBAR (injected)│ │
│  │    Lovable Editor UI           │  │                    │ │
│  │                                │  │  [Your prompt]     │ │
│  │    ┌─────────────────────┐     │  │  ┌──────────────┐  │ │
│  │    │ Prompt textarea     │◄────┼──┼──│ Editable     │  │ │
│  │    └─────────────────────┘     │  │  │ copy here    │  │ │
│  │              ▲                 │  │  └──────────────┘  │ │
│  │              │                 │  │                    │ │
│  │    ┌─────────────────────┐     │  │  [Send] [Cancel]   │ │
│  │    │ Submit button       │─────┼──┼──► Intercept!      │ │
│  │    └─────────────────────┘     │  │                    │ │
│  │                                │  └────────────────────┘ │
│  └────────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Files

```
extension-prototype/
├── manifest.json       # Chrome extension config
├── content.js          # Injected script - detection & interception
├── sidebar.css         # Sidebar styles
├── icons/
│   └── icon128.png     # Extension icon
└── README.md           # Installation instructions
```

---

## Installation (Developer Mode)

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension-prototype` folder
5. Navigate to lovable.dev and test

---

## Risks & Unknowns

| Risk | Mitigation |
|------|------------|
| Lovable uses non-standard input | Start with common selectors, log what we find |
| React controlled inputs miss our value changes | Use native value setter + input event dispatch |
| Shadow DOM breaks our injection | Use closed shadow root for our UI |
| Submit happens via non-standard method | Capture keyboard + click, observe network |

---

## Validation Questions to Answer

1. **Can we detect the prompt input?** - Console log confirms detection
2. **Can we intercept submit?** - Submit is paused, sidebar opens
3. **Can we relay the prompt?** - Original or edited prompt goes through
4. **Is the UX flow intuitive?** - Manual testing with Edgars

---

## Next Steps After Validation

- If works: Proceed to MVP with full features
- If partial: Document what works, adjust architecture
- If fails: Investigate alternative approaches (bookmarklet, etc.)

---

*Epic created by Winston during quick prototype session*
