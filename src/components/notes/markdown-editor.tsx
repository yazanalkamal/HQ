"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Obsidian-style source editing: Markdown with live syntax styling. */
const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.5em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.3em" },
  { tag: tags.heading3, fontWeight: "700", fontSize: "1.15em" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "oklch(0.445 0 0)", textDecoration: "underline" },
  { tag: tags.url, color: "oklch(0.556 0 0)" },
  { tag: tags.monospace, fontFamily: "ui-monospace, monospace", fontSize: "0.9em" },
  { tag: tags.quote, color: "oklch(0.445 0 0)", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "oklch(0.708 0 0)" },
  { tag: tags.labelName, color: "oklch(0.445 0 0)" },
]);

const theme = EditorView.theme({
  "&": {
    fontSize: "15px",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: "var(--font-sans)",
    lineHeight: "2",
    padding: "0",
    caretColor: "var(--foreground)",
  },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderInlineStartColor: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "oklch(0.922 0 0) !important",
  },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
});

export function MarkdownEditor({
  initialContent,
  onChange,
  onSaveShortcut,
}: {
  initialContent: string;
  onChange: (content: string) => void;
  onSaveShortcut: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onSaveShortcut });

  useEffect(() => {
    callbacks.current = { onChange, onSaveShortcut };
  }, [onChange, onSaveShortcut]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          history(),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                callbacks.current.onSaveShortcut();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          markdown(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          cmPlaceholder("اكتب بصيغة ماركداون… [[اسم ملاحظة]] للربط"),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
    // recreate only when switching to a different note (initialContent identity on mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} dir="auto" className="min-h-[50vh] [&_.cm-editor]:min-h-[50vh]" />;
}
