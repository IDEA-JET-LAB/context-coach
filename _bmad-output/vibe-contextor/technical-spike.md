# Vibe Contextor - Technical Spike

**Codename:** Vibe Contextor
**Type:** Browser Extension Technical Feasibility Study
**Architect Lead:** Winston (System Architect)
**Date:** 2025-12-20
**Status:** Spike - Investigation Phase

---

## Executive Summary

**Verdict: FEASIBLE with Medium Risk**

Building a browser extension that captures and coaches prompts in Lovable is technically achievable using proven patterns (Grammarly-style DOM observation). The primary risks are DOM structure changes and cross-origin restrictions, both manageable with proper architecture.

---

## 1. Technical Investigation Goals

1. Can we reliably detect Lovable's prompt textarea?
2. Can we intercept the submit action before execution?
3. Can we overlay our UI without breaking Lovable's functionality?
4. Can we integrate with Context Coach's existing journal schema?
5. What are the browser extension permission requirements?

---

## 2. Lovable Platform Analysis

### Target URL Pattern
```
https://lovable.dev/*
https://*.lovable.dev/*
```

### Key DOM Elements (as of December 2024)

**Note:** These selectors WILL change. Architecture must handle this gracefully.

```javascript
// Lovable uses a React-based interface
// Prompt input is typically a textarea or contenteditable div

// Possible selectors (to be validated):
const SELECTORS = {
  // Primary prompt input
  promptInput: '[data-testid="prompt-input"]',
  promptTextarea: 'textarea[placeholder*="prompt"]',
  promptContentEditable: '[contenteditable="true"]',

  // Submit button
  submitButton: 'button[type="submit"]',
  sendButton: '[data-testid="send-button"]',

  // Alternative: form-based detection
  promptForm: 'form[data-prompt-form]'
};
```

### Technical Characteristics

| Aspect | Observation | Implication |
|--------|-------------|-------------|
| Framework | React with controlled inputs | Need MutationObserver for value changes |
| Rendering | Client-side SPA | Content script runs after React hydration |
| Input type | Likely contenteditable or textarea | Both are supportable |
| Submit pattern | Button click or Enter key | Need to intercept both |

---

## 3. Proposed Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Content    │    │  Background  │    │   Popup/     │      │
│  │   Script     │◄──►│   Worker     │◄──►│   Options    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │  Lovable     │    │   Local      │                          │
│  │  DOM Layer   │    │   Storage    │                          │
│  └──────────────┘    └──────────────┘                          │
│                             │                                    │
│                             ▼                                    │
│                      ┌──────────────┐                          │
│                      │  JSONL       │                          │
│                      │  Journal     │                          │
│                      │  (Export)    │                          │
│                      └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Content Script (`content.js`)
- Runs in Lovable page context
- Observes prompt input changes (MutationObserver)
- Injects overlay UI (Shadow DOM)
- Intercepts submit events
- Communicates with background worker

#### Background Worker (`background.js`)
- Manages extension state
- Handles storage operations
- Processes prompt analysis (rule-based or API)
- Coordinates between tabs

#### Popup/Options (`popup.html`, `options.html`)
- User preferences
- Prompt history view
- Score dashboard
- Export functionality

---

## 4. Core Technical Patterns

### Pattern 1: Prompt Input Detection

```javascript
// content.js - Robust input detection with fallbacks

class PromptDetector {
  constructor() {
    this.selectors = [
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="describe" i]',
      '[contenteditable="true"][data-prompt]',
      '[role="textbox"]',
      // Fallback: largest visible textarea
      'textarea:not([hidden])'
    ];
    this.inputElement = null;
  }

  detect() {
    for (const selector of this.selectors) {
      const element = document.querySelector(selector);
      if (element && this.isVisible(element)) {
        this.inputElement = element;
        return element;
      }
    }
    return null;
  }

  isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Watch for dynamic DOM changes (React re-renders)
  observe(callback) {
    const observer = new MutationObserver(() => {
      const input = this.detect();
      if (input !== this.inputElement) {
        this.inputElement = input;
        callback(input);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }
}
```

### Pattern 2: Input Value Monitoring

```javascript
// Monitor input changes with debouncing

class InputMonitor {
  constructor(element, onChangeCallback) {
    this.element = element;
    this.onChangeCallback = onChangeCallback;
    this.lastValue = '';
    this.debounceTimer = null;
    this.DEBOUNCE_MS = 300;
  }

  start() {
    // For textarea
    if (this.element.tagName === 'TEXTAREA') {
      this.element.addEventListener('input', this.handleInput.bind(this));
    }

    // For contenteditable
    if (this.element.contentEditable === 'true') {
      const observer = new MutationObserver(this.handleInput.bind(this));
      observer.observe(this.element, {
        characterData: true,
        childList: true,
        subtree: true
      });
    }

    // For React controlled inputs (value set programmatically)
    this.valueObserver = this.observeValueProperty();
  }

  observeValueProperty() {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    );

    const self = this;
    Object.defineProperty(this.element, 'value', {
      get() {
        return descriptor.get.call(this);
      },
      set(val) {
        descriptor.set.call(this, val);
        self.handleInput();
      }
    });
  }

  handleInput() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const currentValue = this.getValue();
      if (currentValue !== this.lastValue) {
        this.lastValue = currentValue;
        this.onChangeCallback(currentValue);
      }
    }, this.DEBOUNCE_MS);
  }

  getValue() {
    if (this.element.tagName === 'TEXTAREA') {
      return this.element.value;
    }
    return this.element.textContent;
  }
}
```

### Pattern 3: Submit Interception

```javascript
// Intercept submit without breaking Lovable's functionality

class SubmitInterceptor {
  constructor(options) {
    this.shouldIntercept = options.shouldIntercept; // function(prompt) => boolean
    this.onIntercept = options.onIntercept; // function(prompt, proceed)
  }

  attach(formOrButton) {
    // Button click interception
    if (formOrButton.tagName === 'BUTTON') {
      formOrButton.addEventListener('click', this.handleClick.bind(this), {
        capture: true  // Capture phase - runs before other handlers
      });
    }

    // Form submit interception
    if (formOrButton.tagName === 'FORM') {
      formOrButton.addEventListener('submit', this.handleSubmit.bind(this), {
        capture: true
      });
    }

    // Enter key in textarea
    document.addEventListener('keydown', this.handleKeydown.bind(this), {
      capture: true
    });
  }

  handleClick(event) {
    const prompt = this.getCurrentPrompt();
    if (this.shouldIntercept(prompt)) {
      event.stopPropagation();
      event.preventDefault();

      this.onIntercept(prompt, () => {
        // Proceed with original action
        event.target.click();
      });
    }
  }

  handleSubmit(event) {
    const prompt = this.getCurrentPrompt();
    if (this.shouldIntercept(prompt)) {
      event.stopPropagation();
      event.preventDefault();

      this.onIntercept(prompt, () => {
        event.target.submit();
      });
    }
  }

  handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target;
      if (this.isPromptInput(target)) {
        const prompt = this.getCurrentPrompt();
        if (this.shouldIntercept(prompt)) {
          event.stopPropagation();
          event.preventDefault();

          this.onIntercept(prompt, () => {
            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true
            }));
          });
        }
      }
    }
  }
}
```

### Pattern 4: Shadow DOM Overlay

```javascript
// Inject UI without affecting Lovable's styles

class OverlayManager {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
  }

  init() {
    // Create container that won't be affected by Lovable's CSS
    this.container = document.createElement('div');
    this.container.id = 'vibe-contextor-root';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
    `;

    // Shadow DOM for style isolation
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    // Inject our styles
    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    document.body.appendChild(this.container);
  }

  showTooltip(targetElement, content) {
    const rect = targetElement.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'vc-tooltip';
    tooltip.innerHTML = content;
    tooltip.style.cssText = `
      position: absolute;
      top: ${rect.bottom + 8}px;
      left: ${rect.left}px;
      pointer-events: auto;
    `;

    this.shadowRoot.appendChild(tooltip);
    return tooltip;
  }

  showModal(content, onProceed, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'vc-modal-overlay';
    modal.innerHTML = `
      <div class="vc-modal">
        ${content}
        <div class="vc-modal-actions">
          <button class="vc-btn-primary" data-action="proceed">Send Improved</button>
          <button class="vc-btn-secondary" data-action="cancel">Send Original</button>
        </div>
      </div>
    `;
    modal.style.pointerEvents = 'auto';

    modal.querySelector('[data-action="proceed"]').onclick = () => {
      this.removeElement(modal);
      onProceed();
    };

    modal.querySelector('[data-action="cancel"]').onclick = () => {
      this.removeElement(modal);
      onCancel();
    };

    this.shadowRoot.appendChild(modal);
    return modal;
  }

  getStyles() {
    return `
      .vc-tooltip {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        max-width: 300px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
      }

      .vc-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .vc-modal {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
      }

      .vc-btn-primary {
        background: #8B5CF6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
      }

      .vc-btn-secondary {
        background: transparent;
        border: 1px solid #d1d5db;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
      }
    `;
  }
}
```

---

## 5. Prompt Analysis Engine

### Rule-Based Analysis (MVP)

```javascript
// No AI/API required - pure pattern matching

const PROMPT_RULES = [
  {
    id: 'vague-adjective',
    pattern: /\b(better|nicer|prettier|good|nice|cool|awesome)\b/gi,
    message: (match) => `"${match}" is subjective. Try being specific about what you want.`,
    severity: 'warning',
    suggestion: (match, prompt) => {
      const suggestions = {
        'better': 'more readable / faster / simpler',
        'nicer': 'with rounded corners / in blue / with more padding',
        'prettier': 'with consistent spacing / aligned to grid'
      };
      return suggestions[match.toLowerCase()] || 'be specific';
    }
  },
  {
    id: 'vague-verb',
    pattern: /\b(fix|change|update|modify)\s+(the|it|this)\b/gi,
    message: 'What specifically needs to be fixed/changed?',
    severity: 'warning'
  },
  {
    id: 'too-short',
    pattern: (prompt) => prompt.split(/\s+/).length < 5,
    message: 'Very short prompts often lead to unexpected results. Add more detail.',
    severity: 'info'
  },
  {
    id: 'missing-context',
    pattern: /\b(it|this|that|the thing)\b/gi,
    message: (match) => `What does "${match}" refer to? Be explicit.`,
    severity: 'info'
  },
  {
    id: 'good-specificity',
    pattern: /\b(button|input|header|footer|navbar|sidebar|modal|form|table|card)\b/gi,
    message: null, // Positive signal, not a warning
    severity: 'positive'
  }
];

function analyzePrompt(prompt) {
  const issues = [];
  let score = 5; // Start with perfect score

  for (const rule of PROMPT_RULES) {
    let matches;

    if (typeof rule.pattern === 'function') {
      if (rule.pattern(prompt)) {
        matches = [prompt];
      }
    } else {
      matches = prompt.match(rule.pattern);
    }

    if (matches && rule.severity !== 'positive') {
      issues.push({
        rule: rule.id,
        matches,
        message: typeof rule.message === 'function'
          ? rule.message(matches[0])
          : rule.message,
        severity: rule.severity,
        suggestion: rule.suggestion?.(matches[0], prompt)
      });

      // Reduce score based on severity
      score -= rule.severity === 'warning' ? 1 : 0.5;
    }

    if (matches && rule.severity === 'positive') {
      score += 0.5; // Reward good patterns
    }
  }

  return {
    score: Math.max(1, Math.min(5, score)), // Clamp 1-5
    issues,
    hasBlockingIssues: issues.some(i => i.severity === 'warning')
  };
}
```

---

## 6. Storage and Journal Integration

### Local Storage Schema

```javascript
// Extend Context Coach journal schema for browser context

const ENTRY_SCHEMA = {
  id: "vc-xxxxxxxxxxxx", // vc prefix for Vibe Contextor
  version: "1.1",
  source: "vibe-contextor",
  user_id: "anonymous", // No login required
  timestamp: "2024-12-20T10:30:00Z",
  prompt: {
    text: "Make the button prettier",
    char_count: 24,
    word_count: 4
  },
  context: {
    platform: "lovable",
    url: "https://lovable.dev/projects/abc123",
    project_id: "abc123"
  },
  analysis: {
    score: 2.5,
    issues: ["vague-adjective"],
    suggestions_shown: true,
    suggestion_accepted: false,
    original_prompt: "Make the button prettier",
    modified_prompt: null
  }
};

// Storage operations
class JournalStorage {
  constructor() {
    this.STORAGE_KEY = 'vibe-contextor-journal';
  }

  async save(entry) {
    const journal = await this.getAll();
    journal.push(entry);

    // Keep last 1000 entries
    if (journal.length > 1000) {
      journal.shift();
    }

    await chrome.storage.local.set({
      [this.STORAGE_KEY]: journal
    });
  }

  async getAll() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  async export() {
    const journal = await this.getAll();
    const jsonl = journal.map(e => JSON.stringify(e)).join('\n');
    return jsonl;
  }
}
```

---

## 7. Chrome Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "Vibe Contextor",
  "version": "0.1.0",
  "description": "Write better prompts for Lovable. Get real-time coaching before you hit submit.",

  "permissions": [
    "storage",
    "activeTab"
  ],

  "host_permissions": [
    "https://lovable.dev/*",
    "https://*.lovable.dev/*"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["https://lovable.dev/*", "https://*.lovable.dev/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Lovable DOM changes** | High | High | Abstract selectors, quick patch process, multiple fallbacks |
| **React controlled inputs miss events** | Medium | High | Prototype Object.defineProperty for value |
| **Shadow DOM conflicts** | Low | Medium | Use closed shadow DOM, unique naming |
| **Extension store rejection** | Low | High | Follow all policies, minimal permissions |
| **Performance impact** | Low | Medium | Debounce all observers, lazy initialization |
| **Cross-origin restrictions** | Low | Low | Stay within Lovable domain only |

---

## 9. Prototype Scope

### Week 1 Prototype Deliverables

1. **Minimal Chrome extension** that loads on Lovable
2. **Prompt detection** - Console log when prompt text changes
3. **Basic analysis** - 3 rules (vague adjective, too short, missing context)
4. **Tooltip display** - Show suggestion on hover
5. **Local storage** - Save prompts to chrome.storage

### Prototype Success Criteria

- [ ] Extension loads without errors on lovable.dev
- [ ] Detects prompt textarea within 2 seconds of page load
- [ ] Captures input changes with <500ms latency
- [ ] Displays tooltip at correct position
- [ ] Stores entries retrievable via popup

---

## 10. Future Technical Considerations

### Multi-Platform Extension

```javascript
// Platform adapter pattern for future expansion

const PLATFORMS = {
  lovable: {
    urlPattern: /lovable\.dev/,
    selectors: { /* lovable-specific */ }
  },
  bolt: {
    urlPattern: /bolt\.new/,
    selectors: { /* bolt-specific */ }
  },
  replit: {
    urlPattern: /replit\.com/,
    selectors: { /* replit-specific */ }
  }
};

function getPlatformAdapter(url) {
  for (const [name, config] of Object.entries(PLATFORMS)) {
    if (config.urlPattern.test(url)) {
      return new PlatformAdapter(name, config);
    }
  }
  return null;
}
```

### AI-Powered Suggestions (Post-MVP)

```javascript
// Optional LLM integration for advanced suggestions

async function getAISuggestion(prompt, context) {
  // Could use:
  // - OpenAI API (cost: ~$0.001 per suggestion)
  // - Local LLM via Ollama
  // - Custom fine-tuned model

  const response = await fetch('https://api.vibe-contextor.com/suggest', {
    method: 'POST',
    body: JSON.stringify({ prompt, context })
  });

  return response.json();
}
```

---

## 11. Conclusion

**Technical Verdict: GO**

The Vibe Contextor browser extension is technically feasible with well-established patterns. Key recommendations:

1. **Start with Lovable-only** - Don't abstract for multi-platform yet
2. **Rule-based analysis first** - Avoid AI complexity for MVP
3. **Shadow DOM for UI** - Clean isolation from host page
4. **Prototype early** - Validate DOM detection before full build
5. **Plan for DOM changes** - Lovable will update; design for quick patches

**Next Steps:**
1. Create minimal prototype (1 week)
2. Validate on live Lovable projects
3. User test with 3-5 vibe coders
4. Iterate before full development

---

*Document authored by Winston (System Architect) during Party Mode brainstorming session.*
