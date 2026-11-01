/**
 * Simple Markdown renderer — supports bold, italic, links, lists, paragraphs.
 * No raw HTML passthrough. Links get rel="noopener noreferrer" target="_blank".
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let result = escapeHtml(text);

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
  );

  return result;
}

export function Markdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Unordered list
    if (/^[\-\*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*]\s/.test(lines[i]?.trim() ?? "")) {
        items.push(renderInline((lines[i]!).replace(/^[\-\*]\s+/, "")));
        i++;
      }
      blocks.push(`<ul>${items.map((it) => `<li>${it}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]?.trim() ?? "")) {
        items.push(renderInline((lines[i]!).replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push(`<ol>${items.map((it) => `<li>${it}</li>`).join("")}</ol>`);
      continue;
    }

    // Paragraph — collect consecutive non-blank, non-list lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^[\-\*]\s/.test(lines[i]!) &&
      !/^\d+\.\s/.test(lines[i]!)
    ) {
      para.push(renderInline(lines[i]!));
      i++;
    }
    if (para.length > 0) {
      blocks.push(`<p>${para.join("<br />")}</p>`);
    }
  }

  return (
    <div
      className="markdown-content"
      style={{
        lineHeight: 1.65,
        fontSize: "var(--text-base)",
        color: "var(--text)",
      }}
      dangerouslySetInnerHTML={{ __html: blocks.join("") }}
    />
  );
}
