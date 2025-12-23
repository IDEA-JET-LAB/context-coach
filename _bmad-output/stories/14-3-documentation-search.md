# Story 14.3: Documentation Search

Status: Future
Priority: Low (Future Enhancement)
Depends On: Story 14.1, Story 14.2

## Story

**As a** user,
**I want** to search the documentation,
**So that** I can quickly find answers to specific questions.

## Status: Future Enhancement

This story is marked as a future enhancement. It should not be implemented until:
1. Stories 14.1 and 14.2 are complete
2. Documentation content has grown substantially
3. Users request search functionality

## Acceptance Criteria (For Future Reference)

### Happy Path

1. **Given** I am on any docs page
   **When** I see the search input
   **Then** I can type a search query

2. **Given** I type a search query
   **When** results are found
   **Then** I see a list of matching sections with snippets
   **And** search terms are highlighted

3. **Given** I click a search result
   **When** the page loads
   **Then** I am taken to the relevant section
   **And** the search term is highlighted on the page

### Edge Cases

4. **Given** I type a search query
   **When** no results are found
   **Then** I see a helpful "No results found" message
   **And** suggestions for refining my search are displayed

5. **Given** I type a query with fewer than 2 characters
   **When** I stop typing
   **Then** the search does not execute
   **And** I see a hint indicating minimum query length

6. **Given** I type a query with special characters (e.g., `<script>`, `&`, `"`)
   **When** the search executes
   **Then** special characters are properly escaped
   **And** no XSS or injection vulnerabilities are introduced

### Keyboard Accessibility

7. **Given** I am on any docs page
   **When** I press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
   **Then** the search input is focused and a search modal opens

8. **Given** the search results dropdown is visible
   **When** I press the up/down arrow keys
   **Then** I can navigate through results
   **And** the currently selected result is visually highlighted

9. **Given** the search modal or dropdown is open
   **When** I press Escape
   **Then** the search UI closes
   **And** focus returns to the previous element

### Error Handling

10. **Given** the search index fails to load
    **When** I attempt to search
    **Then** I see an error message with retry option
    **And** the error is logged for debugging

### Performance

11. **Given** I type a search query
    **When** results are computed
    **Then** results appear in less than 100ms

12. **Given** the documentation pages load
    **When** the search index is initialized
    **Then** the index size is less than 500KB compressed

## Implementation Options (For Future Reference)

### Option A: Client-Side Search (Fuse.js)

**Pros:**
- No external dependencies
- Works offline
- Fast for small docs

**Cons:**
- Loads all content upfront
- Slower for large docs

```typescript
// Example implementation
import Fuse from 'fuse.js';

const fuse = new Fuse(docsContent, {
  keys: ['title', 'content'],
  includeMatches: true,
  threshold: 0.3,
});

const results = fuse.search(query);
```

### Option B: Algolia DocSearch

**Pros:**
- Powerful search
- Handles large docs
- Good UX out of box

**Cons:**
- External service
- Requires Algolia account
- May have costs at scale

### Recommendation

Start with **Option A (Fuse.js)** when implementing:
- Simpler to set up
- No external dependencies
- Sufficient for current docs size
- Can migrate to Algolia later if needed

## Tasks (For Future Implementation)

### 1. Install Dependencies
- [ ] Install Fuse.js: `cd app && npm install fuse.js`
- [ ] Install types: `cd app && npm install -D @types/fuse.js`

### 2. Create Search Index Infrastructure
- [ ] Create search index generator: `app/lib/docs/search-index.ts`
  - Parse all MDX files from `app/app/(main)/docs/` directory
  - Extract title, headings, and content
  - Generate JSON index file at build time
- [ ] Create search index type definitions: `app/lib/docs/types.ts`
  - Define `SearchableDocument` interface
  - Define `SearchResult` interface with match highlights

### 3. Create Search Components
- [ ] Create search modal component: `app/components/docs/search-modal.tsx`
  - Modal overlay with search input
  - Results list with keyboard navigation
  - Loading and error states
- [ ] Create search input trigger: `app/components/docs/search-trigger.tsx`
  - Button to open search modal
  - Shows keyboard shortcut hint (Cmd/Ctrl+K)
- [ ] Create search result item: `app/components/docs/search-result-item.tsx`
  - Display title, section, and highlighted snippet
  - Handle click navigation

### 4. Create Search Hook and Utilities
- [ ] Create search hook: `app/lib/hooks/use-docs-search.ts`
  - Initialize Fuse.js instance
  - Handle debounced search queries
  - Return results with loading/error states
- [ ] Create text sanitization utility: `app/lib/docs/sanitize-query.ts`
  - Escape special characters
  - Validate minimum query length
  - Prevent XSS in highlights

### 5. Integrate Search into Docs Layout
- [ ] Update docs sidebar: `app/components/docs/docs-sidebar.tsx`
  - Add search trigger button at top
- [ ] Add global keyboard shortcut handler to docs layout: `app/app/(main)/docs/layout.tsx`
  - Listen for Cmd/Ctrl+K
  - Open search modal

### 6. Add Highlight on Page
- [ ] Create highlight utility: `app/lib/docs/highlight-text.ts`
  - Parse URL query param for search term
  - Scroll to and highlight matching text on page load

## Test Plan

### Unit Tests (`app/__tests__/docs/`)

- [ ] `search-index.test.ts`
  - Test MDX parsing extracts correct content
  - Test index generation with various document structures
  - Test handling of empty or malformed documents

- [ ] `sanitize-query.test.ts`
  - Test minimum query length validation (2+ chars)
  - Test special character escaping (`<`, `>`, `&`, `"`, `'`)
  - Test XSS prevention patterns

- [ ] `use-docs-search.test.ts`
  - Test search returns relevant results
  - Test fuzzy matching behavior
  - Test empty query returns no results
  - Test debouncing prevents excessive searches

### E2E Tests (`app/e2e/docs-search.spec.ts`)

- [ ] Test search modal opens with Cmd/Ctrl+K
- [ ] Test search modal opens when clicking search button
- [ ] Test typing query shows results
- [ ] Test clicking result navigates to correct page
- [ ] Test arrow key navigation through results
- [ ] Test Escape closes search modal
- [ ] Test "No results found" message displays correctly
- [ ] Test minimum query length hint appears
- [ ] Test search term is highlighted on destination page

### Performance Tests

- [ ] Verify search results appear in <100ms (measure in E2E test)
- [ ] Verify search index is <500KB compressed (check in build step)
- [ ] Test search performance with 50+ documentation pages

## Notes

- Re-evaluate this story when docs exceed 10 pages
- Consider user feedback on docs navigation
- May combine with in-page search (Ctrl+F enhancement)

## References

- [Fuse.js Documentation](https://fusejs.io/)
- [Algolia DocSearch](https://docsearch.algolia.com/)
- [Source: _bmad-output/epics.md#Story-14.3]
