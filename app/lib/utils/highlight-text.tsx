import { Fragment, useMemo } from 'react';

interface HighlightTextProps {
  text: string;
  search: string;
}

// Maximum search string length to prevent ReDoS attacks (M35)
const MAX_SEARCH_LENGTH = 200;

/**
 * Escapes special regex characters to prevent ReDoS attacks.
 * This function escapes all characters that have special meaning in regex.
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely creates a regex for highlighting, with protections against ReDoS.
 * Returns null if the search is empty or too long.
 */
function createSafeHighlightRegex(search: string): RegExp | null {
  // Trim and limit search length to prevent ReDoS
  const trimmedSearch = search.trim();
  if (!trimmedSearch || trimmedSearch.length > MAX_SEARCH_LENGTH) {
    return null;
  }

  // Escape special characters to treat search as literal text
  const escaped = escapeRegex(trimmedSearch);

  try {
    return new RegExp(`(${escaped})`, 'gi');
  } catch {
    // In case of any unexpected regex compilation error
    return null;
  }
}

export function HighlightText({ text, search }: HighlightTextProps) {
  // Memoize regex creation to avoid recreating on every render
  const regex = useMemo(() => createSafeHighlightRegex(search), [search]);

  if (!regex) return <>{text}</>;

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-500/30 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
