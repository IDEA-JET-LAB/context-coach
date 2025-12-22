/**
 * Vibe Contextor - Prototype Content Script
 *
 * This script:
 * 1. Detects Lovable's prompt input
 * 2. Intercepts submit actions
 * 3. Shows captured prompt in a sidebar
 * 4. Relays the (optionally edited) prompt back to Lovable
 */

(function() {
  'use strict';

  const VERSION = '0.0.4';

  // Very visible load indicator
  console.log(`%c[Vibe Contextor v${VERSION}] Content script loaded!`, 'background: #8B5CF6; color: white; padding: 4px 8px; border-radius: 4px;');
  console.log('[Vibe Contextor] URL:', window.location.href);

  // Also show an alert for debugging (remove this later)
  // Uncomment the next line if you want a popup confirmation:
  // alert('Vibe Contextor loaded!');

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    // Selectors to try for finding the prompt input (in order of preference)
    // Lovable uses ProseMirror - look for its specific elements
    inputSelectors: [
      // ProseMirror editor (Lovable's actual input)
      '.ProseMirror',
      '[data-placeholder="Ask Lovable..."]',
      '[contenteditable="true"].ProseMirror',
      // Fallbacks for other potential inputs
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="describe" i]',
      'textarea[placeholder*="what" i]',
      'textarea[placeholder*="ask" i]',
      '[contenteditable="true"][data-placeholder]',
      '[role="textbox"]',
      'textarea:not([hidden]):not([style*="display: none"])'
    ],
    // Selectors for submit button
    submitSelectors: [
      'button[type="submit"]',
      'button[aria-label*="send" i]',
      'button[aria-label*="submit" i]',
      '[data-testid*="send"]',
      '[data-testid*="submit"]',
      // Common icon button patterns
      'button svg',
      'button[class*="send"]'
    ],
    debounceMs: 300
  };

  // ============================================
  // STATE
  // ============================================

  let state = {
    promptInput: null,
    submitButton: null,
    sidebarVisible: false,
    interceptedPrompt: '',
    originalSubmitHandler: null,
    bypassIntercept: false  // Flag to allow submit to pass through
  };

  // ============================================
  // SIDEBAR UI
  // ============================================

  function createSidebar() {
    // Check if already exists
    if (document.getElementById('vc-sidebar-root')) {
      return document.getElementById('vc-sidebar-root');
    }

    const sidebar = document.createElement('div');
    sidebar.id = 'vc-sidebar-root';
    sidebar.innerHTML = `
      <div id="vc-sidebar" class="vc-sidebar vc-hidden">
        <div class="vc-header">
          <span class="vc-title">Vibe Contextor</span>
          <button class="vc-close" id="vc-close">&times;</button>
        </div>
        <div class="vc-body">
          <label class="vc-label">Your prompt:</label>
          <textarea id="vc-prompt-editor" class="vc-editor" rows="8" placeholder="Your prompt will appear here..."></textarea>
          <div class="vc-hint">
            Edit your prompt here before sending, or send as-is.
          </div>
        </div>
        <div class="vc-footer">
          <button id="vc-send" class="vc-btn vc-btn-primary">Send to Lovable</button>
          <button id="vc-copy" class="vc-btn vc-btn-secondary">Copy & Close</button>
          <button id="vc-cancel" class="vc-btn vc-btn-text">Cancel</button>
        </div>
        <div class="vc-debug">
          <details>
            <summary>Debug Info</summary>
            <pre id="vc-debug-info">Loading...</pre>
          </details>
        </div>
      </div>
      <button id="vc-toggle" class="vc-toggle" title="Open Vibe Contextor">
        VC
      </button>
    `;

    document.body.appendChild(sidebar);

    // Wire up events
    document.getElementById('vc-close').addEventListener('click', hideSidebar);
    document.getElementById('vc-cancel').addEventListener('click', hideSidebar);
    document.getElementById('vc-send').addEventListener('click', sendPrompt);
    document.getElementById('vc-copy').addEventListener('click', copyAndClose);
    document.getElementById('vc-toggle').addEventListener('click', toggleSidebar);

    console.log('[Vibe Contextor] Sidebar created');
    return sidebar;
  }

  function showSidebar(promptText) {
    const sidebar = document.getElementById('vc-sidebar');
    const editor = document.getElementById('vc-prompt-editor');
    const toggle = document.getElementById('vc-toggle');

    if (sidebar && editor) {
      state.interceptedPrompt = promptText;
      editor.value = promptText;
      sidebar.classList.remove('vc-hidden');
      toggle.classList.add('vc-hidden');
      state.sidebarVisible = true;
      editor.focus();
      updateDebugInfo();
      console.log('[Vibe Contextor] Sidebar shown with prompt:', promptText.substring(0, 50) + '...');
    }
  }

  function hideSidebar() {
    const sidebar = document.getElementById('vc-sidebar');
    const toggle = document.getElementById('vc-toggle');

    if (sidebar) {
      sidebar.classList.add('vc-hidden');
      toggle.classList.remove('vc-hidden');
      state.sidebarVisible = false;
      console.log('[Vibe Contextor] Sidebar hidden');
    }
  }

  function toggleSidebar() {
    if (state.sidebarVisible) {
      hideSidebar();
    } else {
      // Get current prompt value
      const currentPrompt = getPromptValue();
      showSidebar(currentPrompt || '(No prompt detected - try typing something first)');
    }
  }

  function updateDebugInfo() {
    const debugEl = document.getElementById('vc-debug-info');
    if (debugEl) {
      debugEl.textContent = JSON.stringify({
        inputFound: !!state.promptInput,
        inputTag: state.promptInput?.tagName,
        inputSelector: state.promptInput?.className?.substring(0, 50),
        submitFound: !!state.submitButton,
        promptLength: state.interceptedPrompt?.length || 0
      }, null, 2);
    }
  }

  // ============================================
  // PROMPT DETECTION
  // ============================================

  function detectPromptInput() {
    for (const selector of CONFIG.inputSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (isVisibleElement(el)) {
          console.log('[Vibe Contextor] Found prompt input with selector:', selector);
          return el;
        }
      }
    }
    return null;
  }

  function detectSubmitButton() {
    for (const selector of CONFIG.submitSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (isVisibleElement(el)) {
          console.log('[Vibe Contextor] Found submit button with selector:', selector);
          return el;
        }
      }
    }
    return null;
  }

  function isVisibleElement(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 &&
           rect.height > 0 &&
           style.display !== 'none' &&
           style.visibility !== 'hidden';
  }

  function getPromptValue() {
    if (!state.promptInput) return '';

    if (state.promptInput.tagName === 'TEXTAREA' || state.promptInput.tagName === 'INPUT') {
      return state.promptInput.value;
    }

    // ProseMirror and contenteditable handling
    if (state.promptInput.contentEditable === 'true' || state.promptInput.classList.contains('ProseMirror')) {
      // ProseMirror stores text in <p> elements, get innerText for proper line breaks
      return state.promptInput.innerText.trim();
    }
    return '';
  }

  function setPromptValue(value) {
    if (!state.promptInput) return false;

    if (state.promptInput.tagName === 'TEXTAREA' || state.promptInput.tagName === 'INPUT') {
      // For React controlled inputs, we need to use the native value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(state.promptInput, value);
      } else {
        state.promptInput.value = value;
      }

      // Dispatch input event to trigger React's onChange
      state.promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    // ProseMirror and contenteditable handling
    if (state.promptInput.contentEditable === 'true' || state.promptInput.classList.contains('ProseMirror')) {
      console.log('[Vibe Contextor] Setting ProseMirror value using selection/execCommand');

      // Focus the element first
      state.promptInput.focus();

      // Select all existing content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(state.promptInput);
      selection.removeAllRanges();
      selection.addRange(range);

      // Try multiple methods to insert text properly

      // Method 1: Use execCommand (deprecated but works well with contenteditable)
      const inserted = document.execCommand('insertText', false, value);
      console.log('[Vibe Contextor] execCommand insertText result:', inserted);

      if (!inserted) {
        // Method 2: Use insertText via InputEvent (modern approach)
        // First clear, then insert
        document.execCommand('delete', false, null);

        // Create and dispatch an InputEvent
        const inputEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value
        });
        state.promptInput.dispatchEvent(inputEvent);

        // Also try direct text insertion
        const textNode = document.createTextNode(value);
        const p = document.createElement('p');
        p.appendChild(textNode);
        state.promptInput.innerHTML = '';
        state.promptInput.appendChild(p);

        // Dispatch input event
        state.promptInput.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value
        }));
      }

      // Dispatch additional events that ProseMirror might listen to
      state.promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      state.promptInput.dispatchEvent(new Event('change', { bubbles: true }));

      console.log('[Vibe Contextor] Set ProseMirror value:', value.substring(0, 50));
      return true;
    }

    return false;
  }

  // ============================================
  // INTERCEPTION
  // ============================================

  function interceptSubmit(event) {
    // Check bypass flag - if true, let it through
    if (state.bypassIntercept) {
      console.log('[Vibe Contextor] Bypass flag set, allowing submit through');
      state.bypassIntercept = false;  // Reset for next time
      return;
    }

    const promptValue = getPromptValue();

    if (!promptValue || promptValue.trim() === '') {
      console.log('[Vibe Contextor] Empty prompt, not intercepting');
      return; // Let empty prompts through
    }

    console.log('[Vibe Contextor] Intercepting submit with prompt:', promptValue.substring(0, 50));

    // Stop the original submit
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Show our sidebar with the captured prompt
    showSidebar(promptValue);
  }

  function interceptKeydown(event) {
    // Check bypass flag
    if (state.bypassIntercept) {
      console.log('[Vibe Contextor] Bypass flag set, allowing keydown through');
      return;
    }

    // Check for Enter without Shift (common submit pattern)
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target;

      // Check if the target is our prompt input
      if (target === state.promptInput || state.promptInput?.contains(target)) {
        const promptValue = getPromptValue();

        if (promptValue && promptValue.trim() !== '') {
          console.log('[Vibe Contextor] Intercepting Enter key submit');
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          showSidebar(promptValue);
        }
      }
    }
  }

  async function copyAndClose() {
    const editor = document.getElementById('vc-prompt-editor');
    const editedPrompt = editor?.value || state.interceptedPrompt;

    try {
      await navigator.clipboard.writeText(editedPrompt);
      console.log('[Vibe Contextor] Copied to clipboard:', editedPrompt.substring(0, 50));

      // Show brief feedback
      const copyBtn = document.getElementById('vc-copy');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);

      // Focus the Lovable input and select all so user can just Cmd+V
      state.promptInput.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(state.promptInput);
      selection.removeAllRanges();
      selection.addRange(range);

      // Hide sidebar after a moment
      setTimeout(hideSidebar, 500);

    } catch (err) {
      console.error('[Vibe Contextor] Copy failed:', err);
      alert('Copy failed - please select and copy manually');
    }
  }

  async function sendPrompt() {
    const editor = document.getElementById('vc-prompt-editor');
    const editedPrompt = editor?.value || state.interceptedPrompt;

    console.log('[Vibe Contextor] Sending prompt:', editedPrompt.substring(0, 50));

    // Hide sidebar first
    hideSidebar();

    // Focus the input
    state.promptInput.focus();

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(state.promptInput);
    selection.removeAllRanges();
    selection.addRange(range);

    // Try Method 1: execCommand
    let success = document.execCommand('insertText', false, editedPrompt);
    console.log('[Vibe Contextor] execCommand result:', success);

    // If execCommand didn't work, try clipboard paste
    if (!success) {
      console.log('[Vibe Contextor] Trying clipboard paste method...');
      try {
        // Write to clipboard
        await navigator.clipboard.writeText(editedPrompt);

        // Simulate paste
        document.execCommand('paste');

        // Or dispatch paste event
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer()
        });
        pasteEvent.clipboardData.setData('text/plain', editedPrompt);
        state.promptInput.dispatchEvent(pasteEvent);

        success = true;
      } catch (err) {
        console.log('[Vibe Contextor] Clipboard method failed:', err);
      }
    }

    // Give ProseMirror time to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set bypass flag so our interceptor lets the submit through
    state.bypassIntercept = true;
    console.log('[Vibe Contextor] Bypass flag set, triggering submit...');

    // Now trigger submit
    if (state.submitButton) {
      console.log('[Vibe Contextor] Clicking submit button');
      state.submitButton.click();
    } else {
      // Try finding submit button again
      const submitBtn = document.querySelector('button[type="submit"], button[aria-label*="send" i]');
      if (submitBtn) {
        console.log('[Vibe Contextor] Found and clicking submit button');
        submitBtn.click();
      } else {
        console.log('[Vibe Contextor] No submit button found, trying Enter key');
        state.promptInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }
    }

    // Reset bypass flag after a short delay (in case the click didn't trigger our interceptor)
    setTimeout(() => {
      state.bypassIntercept = false;
    }, 500);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function attachInterceptors() {
    if (state.submitButton) {
      state.submitButton.addEventListener('click', interceptSubmit, { capture: true });
      console.log('[Vibe Contextor] Attached click interceptor to submit button');
    }

    // Always attach keyboard listener for Enter key
    document.addEventListener('keydown', interceptKeydown, { capture: true });
    console.log('[Vibe Contextor] Attached keyboard interceptor');
  }

  function scanForElements() {
    const newInput = detectPromptInput();
    const newSubmit = detectSubmitButton();

    let changed = false;

    if (newInput !== state.promptInput) {
      state.promptInput = newInput;
      changed = true;
      if (newInput) {
        console.log('[Vibe Contextor] Prompt input detected:', newInput.tagName, newInput.className?.substring(0, 30));
      }
    }

    if (newSubmit !== state.submitButton) {
      // Remove old listener if exists
      if (state.submitButton) {
        state.submitButton.removeEventListener('click', interceptSubmit, { capture: true });
      }
      state.submitButton = newSubmit;
      if (newSubmit) {
        newSubmit.addEventListener('click', interceptSubmit, { capture: true });
        console.log('[Vibe Contextor] Submit button detected and interceptor attached');
      }
      changed = true;
    }

    if (changed) {
      updateDebugInfo();
    }
  }

  function init() {
    console.log('[Vibe Contextor] Initializing...');

    // Create sidebar
    createSidebar();

    // Initial scan
    scanForElements();
    attachInterceptors();

    // Watch for DOM changes (SPA navigation, React re-renders)
    const observer = new MutationObserver((mutations) => {
      // Debounce the scan
      clearTimeout(window.vcScanTimeout);
      window.vcScanTimeout = setTimeout(scanForElements, CONFIG.debounceMs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Vibe Contextor] Initialization complete. Watching for prompt input...');

    // Periodic scan as backup (every 2 seconds)
    setInterval(scanForElements, 2000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
