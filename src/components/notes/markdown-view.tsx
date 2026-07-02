import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Reading view — Thmanyah Serif Text territory (long-form only, per the
 * type guide). Wiki-links [[title]] are resolved to note links server-side
 * via the titles map; unresolved ones render muted.
 */
export function MarkdownView({
  content,
  noteTitles,
}: {
  content: string;
  noteTitles: Map<string, string>;
}) {
  const segments = splitWikiLinks(content);
  const source = segments
    .map((s) =>
      s.type === "text"
        ? s.value
        : noteTitles.has(s.value.trim())
          ? `[${s.value}](/notes/${noteTitles.get(s.value.trim())})`
          : `*${s.value}*`,
    )
    .join("");

  return (
    <div className="markdown-body font-serif" dir="auto">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}

type Segment = { type: "text" | "wiki"; value: string };

function splitWikiLinks(src: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const re = /\[\[([^\[\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ type: "text", value: src.slice(last, m.index) });
    out.push({ type: "wiki", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ type: "text", value: src.slice(last) });
  return out;
}
