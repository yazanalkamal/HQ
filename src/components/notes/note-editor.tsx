"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  ListTodo,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { deleteNote, updateNote } from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownView } from "./markdown-view";
import { cn } from "@/lib/utils";
import type { Note } from "@/db/schema";

type SaveState = "saved" | "dirty" | "saving";

export function NoteEditor({
  note,
  noteTitles,
}: {
  note: Note & { taskTitle: string | null };
  noteTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [content, setContent] = useState(note.content);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const latest = useRef(note.content);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    startTransition(async () => {
      await updateNote({ id: note.id, content: latest.current });
      setSaveState("saved");
    });
  }, [note.id]);

  const onChange = useCallback(
    (c: string) => {
      latest.current = c;
      dirty.current = true;
      setContent(c);
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doSave, 1200);
    },
    [doSave],
  );

  // flush a pending save when navigating away or closing the tab
  useEffect(() => {
    window.addEventListener("beforeunload", doSave);
    return () => {
      window.removeEventListener("beforeunload", doSave);
      doSave();
    };
  }, [doSave]);

  // Ctrl+E toggles edit/read
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setMode((m) => (m === "edit" ? "read" : "edit"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="iconSm" onClick={() => router.push("/notes")} aria-label="عودة">
          <ArrowRight />
        </Button>

        <div className="flex items-center rounded-lg border p-0.5">
          <ModeButton active={mode === "edit"} onClick={() => setMode("edit")}>
            <Pencil className="size-3.5" />
            تحرير
          </ModeButton>
          <ModeButton active={mode === "read"} onClick={() => setMode("read")}>
            <BookOpen className="size-3.5" />
            قراءة
          </ModeButton>
        </div>

        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <Loader2 className="size-3 animate-spin" /> يحفظ…
            </>
          ) : saveState === "dirty" ? (
            "غير محفوظ"
          ) : (
            <>
              <Check className="size-3" /> محفوظ
            </>
          )}
        </span>

        <div className="ms-auto flex items-center gap-1">
          {note.taskId ? (
            <Link
              href={`/tasks?task=${note.taskId}`}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs hover:bg-accent"
            >
              <ListTodo className="size-3" />
              {note.taskTitle ?? "المهمة"}
            </Link>
          ) : null}
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={note.pinned ? "إلغاء التثبيت" : "تثبيت"}
            onClick={() =>
              startTransition(() => updateNote({ id: note.id, pinned: !note.pinned }))
            }
          >
            {note.pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button
            variant="destructive"
            size={confirmDelete ? "sm" : "iconSm"}
            aria-label="حذف الملاحظة"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
                return;
              }
              startTransition(async () => {
                await deleteNote(note.id);
                router.push("/notes");
              });
            }}
          >
            <Trash2 />
            {confirmDelete ? "متأكد؟" : null}
          </Button>
        </div>
      </div>

      {/* title */}
      <input
        defaultValue={note.title}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== note.title) startTransition(() => updateNote({ id: note.id, title: v }));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-full bg-transparent font-display text-3xl font-bold outline-none placeholder:text-muted-foreground"
        placeholder="عنوان الملاحظة"
        dir="auto"
      />

      {/* body */}
      {mode === "edit" ? (
        <MarkdownEditor
          key={note.id}
          initialContent={note.content}
          onChange={onChange}
          onSaveShortcut={doSave}
        />
      ) : (
        <MarkdownView content={content} noteTitles={new Map(Object.entries(noteTitles))} />
      )}
    </div>
  );
}

function ModeButton({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
        active ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
