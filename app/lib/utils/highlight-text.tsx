import { Fragment } from 'react';

interface HighlightTextProps {
  text: string;
  search: string;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightText({ text, search }: HighlightTextProps) {
  if (!search) return <>{text}</>;

  const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
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
