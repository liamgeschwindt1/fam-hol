"use client";

import { useState, useRef, useCallback, useMemo } from "react";

interface MemberOption {
  id: string;
  name: string;
  photoKey: string | null;
}

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  members: MemberOption[];
  placeholder?: string;
  initialValue?: string;
}

export function CommentForm({
  onSubmit,
  members,
  placeholder = "Write a comment...",
  initialValue = "",
}: CommentFormProps) {
  const [body, setBody] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = useMemo(
    () =>
      mentionQuery !== null
        ? members.filter((m) =>
            m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
        : [],
    [mentionQuery, members],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setBody(val);

      // Detect @mention trigger
      const pos = e.target.selectionStart;
      const textBefore = val.slice(0, pos);
      const atMatch = textBefore.match(/@(\w*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1] ?? "");
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    },
    [],
  );

  const insertMention = useCallback(
    (memberName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const pos = textarea.selectionStart;
      const textBefore = body.slice(0, pos);
      const textAfter = body.slice(pos);
      const atIndex = textBefore.lastIndexOf("@");
      if (atIndex === -1) return;

      const newText = textBefore.slice(0, atIndex) + `@${memberName} ` + textAfter;
      setBody(newText);
      setMentionQuery(null);

      // Refocus textarea
      requestAnimationFrame(() => {
        const newPos = atIndex + memberName.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [body],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }, [body, submitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionQuery !== null && filteredMembers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const member = filteredMembers[mentionIndex];
          if (member) insertMention(member.name);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionQuery(null);
          return;
        }
      }

      // Cmd/Ctrl+Enter to submit
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [mentionQuery, filteredMembers, mentionIndex, insertMention, handleSubmit],
  );

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          border: "1px solid var(--rule)",
          backgroundColor: "var(--bg)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          style={{
            width: "100%",
            padding: "var(--space-3) var(--space-4)",
            border: "none",
            background: "transparent",
            color: "var(--ink)",
            fontFamily: "var(--font-hanken), system-ui, sans-serif",
            fontSize: "var(--text-sm)",
            lineHeight: 1.55,
            resize: "vertical",
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-2) var(--space-4)",
            borderTop: "1px solid var(--rule)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            **bold** *italic* [link](url) @mention
          </span>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!body.trim() || submitting}
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: body.trim() ? "var(--sea)" : "var(--rule)",
              color: body.trim() ? "#fff" : "var(--ink-soft)",
              border: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              cursor: body.trim() ? "pointer" : "default",
              minHeight: "36px",
              fontFamily: "var(--font-hanken), system-ui, sans-serif",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* @mention autocomplete dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: "4px",
            backgroundColor: "var(--bg)",
            border: "1px solid var(--rule)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 50,
            minWidth: "200px",
          }}
        >
          {filteredMembers.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m.name)}
              style={{
                display: "flex",
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                textAlign: "left",
                border: "none",
                backgroundColor:
                  i === mentionIndex ? "var(--paper-2)" : "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-hanken), system-ui, sans-serif",
                minHeight: "44px",
                alignItems: "center",
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
