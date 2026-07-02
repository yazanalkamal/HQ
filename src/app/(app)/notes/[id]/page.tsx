import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import { allNoteTitles, getNote } from "@/lib/queries/notes";

export const metadata: Metadata = { title: "ملاحظة" };

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [note, titles] = await Promise.all([getNote(id), allNoteTitles()]);
  if (!note) notFound();

  return <NoteEditor note={note} noteTitles={Object.fromEntries(titles)} />;
}
