"use client";

/**
 * DiffView — editorial inline diff.
 * Additions underlined in moss, removals struck through in clay.
 * Serif body font, word-level diff.
 */

interface DiffViewProps {
  before: string;
  after: string;
}

export function DiffView({ before, after }: DiffViewProps) {
  const tokens = diffWords(before, after);

  return (
    <span
      style={{
        fontFamily: "var(--font-instrument), Georgia, serif",
        fontSize: "var(--text-base)",
        lineHeight: 1.65,
      }}
    >
      {tokens.map((tok, i) => {
        if (tok.type === "equal") {
          return <span key={i}>{tok.text}</span>;
        }
        if (tok.type === "remove") {
          return (
            <span
              key={i}
              style={{
                textDecoration: "line-through",
                textDecorationColor: "var(--clay)",
                color: "var(--clay)",
              }}
            >
              {tok.text}
            </span>
          );
        }
        // add
        return (
          <span
            key={i}
            style={{
              textDecoration: "underline",
              textDecorationColor: "var(--moss)",
              textDecorationThickness: "2px",
              textUnderlineOffset: "2px",
              color: "var(--moss)",
            }}
          >
            {tok.text}
          </span>
        );
      })}
    </span>
  );
}

// ─── Simple word-level diff (LCS-based) ──────────────────────────

type Token = { type: "equal" | "add" | "remove"; text: string };

function diffWords(a: string, b: string): Token[] {
  const wordsA = splitWords(a);
  const wordsB = splitWords(b);

  const lcs = longestCommonSubsequence(wordsA, wordsB);
  const result: Token[] = [];

  let ia = 0;
  let ib = 0;

  for (const match of lcs) {
    // Removals before this match
    while (ia < match.ia) {
      result.push({ type: "remove", text: wordsA[ia]! });
      ia++;
    }
    // Additions before this match
    while (ib < match.ib) {
      result.push({ type: "add", text: wordsB[ib]! });
      ib++;
    }
    // Equal
    result.push({ type: "equal", text: wordsA[ia]! });
    ia++;
    ib++;
  }

  // Remaining removals
  while (ia < wordsA.length) {
    result.push({ type: "remove", text: wordsA[ia]! });
    ia++;
  }
  // Remaining additions
  while (ib < wordsB.length) {
    result.push({ type: "add", text: wordsB[ib]! });
    ib++;
  }

  return mergeTokens(result);
}

function splitWords(text: string): string[] {
  // Split preserving whitespace as part of the preceding word
  const result: string[] = [];
  const re = /(\S+\s*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    result.push(m[1]!);
  }
  return result;
}

function longestCommonSubsequence(
  a: string[],
  b: string[],
): { ia: number; ib: number }[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1]!.trimEnd() === b[j - 1]!.trimEnd()) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack
  const result: { ia: number; ib: number }[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1]!.trimEnd() === b[j - 1]!.trimEnd()) {
      result.push({ ia: i - 1, ib: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return result.reverse();
}

function mergeTokens(tokens: Token[]): Token[] {
  const merged: Token[] = [];
  for (const tok of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.type === tok.type) {
      last.text += tok.text;
    } else {
      merged.push({ ...tok });
    }
  }
  return merged;
}
