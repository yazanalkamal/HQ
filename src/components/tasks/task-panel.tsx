"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Check, Flag, NotebookText, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  addSubtask,
  deleteSubtask,
  deleteTask,
  toggleSubtask,
  toggleTask,
  updateTask,
} from "@/app/(app)/tasks/actions";
import { createNote } from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskCheck } from "@/components/ui/task-check";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { areaDotClass } from "@/lib/areas";
import { cn } from "@/lib/utils";
import type { Area, Subtask } from "@/db/schema";
import type { TaskWithMeta } from "@/lib/queries/tasks";

const PRIORITIES = ["عادية", "مهمة", "عاجلة"] as const;

type TaskDetail = TaskWithMeta & { subtasks: Subtask[] };
type LinkedNote = { id: string; title: string };

export function TaskPanel({
  task,
  areas,
  linkedNotes,
}: {
  task: TaskDetail;
  areas: Area[];
  linkedNotes: LinkedNote[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  function save(patch: Parameters<typeof updateTask>[0]) {
    startTransition(() => updateTask(patch));
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent title="تفاصيل المهمة">
        <div className="space-y-6">
          {/* title + complete */}
          <div className="flex items-start gap-3">
            <TaskCheck
              done={task.done}
              onToggle={() => startTransition(() => toggleTask(task.id, !task.done))}
              className="mt-2"
            />
            <Input
              key={task.id + task.title}
              defaultValue={task.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) save({ id: task.id, title: v });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={cn(
                "border-none px-1 text-base font-medium shadow-none focus-visible:outline-none",
                task.done && "text-muted-foreground line-through",
              )}
            />
          </div>

          {/* meta controls */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">التاريخ</span>
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  key={task.id + (task.dueDate ?? "")}
                  defaultValue={task.dueDate ?? ""}
                  onChange={(e) => save({ id: task.id, dueDate: e.target.value || null })}
                  data-numeric
                />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">الوقت</span>
              <Input
                type="time"
                key={task.id + (task.dueTime ?? "")}
                defaultValue={task.dueTime ?? ""}
                onChange={(e) => save({ id: task.id, dueTime: e.target.value || null })}
                data-numeric
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">الأولوية</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                    <Flag className={cn("size-3.5", task.priority === 2 && "text-destructive")} />
                    {PRIORITIES[task.priority]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {PRIORITIES.map((p, i) => (
                    <DropdownMenuItem
                      key={p}
                      selected={task.priority === i}
                      onSelect={() => save({ id: task.id, priority: i })}
                    >
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">المجال</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                    {task.area ? (
                      <>
                        <span className={cn("size-2 rounded-full", areaDotClass(task.area.color))} />
                        {task.area.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground">بدون مجال</span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {areas.map((a) => (
                    <DropdownMenuItem
                      key={a.id}
                      selected={task.areaId === a.id}
                      onSelect={() => save({ id: task.id, areaId: a.id })}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", areaDotClass(a.color))} />
                        {a.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => save({ id: task.id, areaId: null })}>
                    بدون مجال
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* description */}
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">الوصف</span>
            <Textarea
              key={task.id + "desc"}
              defaultValue={task.description}
              placeholder="تفاصيل إضافية…"
              rows={3}
              onBlur={(e) => {
                if (e.target.value !== task.description)
                  save({ id: task.id, description: e.target.value });
              }}
            />
          </label>

          {/* subtasks */}
          <section className="space-y-2">
            <h3 className="text-xs text-muted-foreground">
              المهام الفرعية
              {task.subtasks.length > 0 ? (
                <span data-numeric>
                  {" "}
                  ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
                </span>
              ) : null}
            </h3>
            <div className="space-y-1">
              {task.subtasks.map((s) => (
                <div key={s.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1">
                  <TaskCheck
                    done={s.done}
                    onToggle={() => startTransition(() => toggleSubtask(s.id, !s.done))}
                    className="size-4"
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      s.done && "text-muted-foreground line-through",
                    )}
                  >
                    {s.title}
                  </span>
                  <button
                    type="button"
                    aria-label="حذف"
                    onClick={() => startTransition(() => deleteSubtask(s.id))}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-1">
              <Plus className="size-3.5 text-muted-foreground" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubtask.trim()) {
                    startTransition(async () => {
                      await addSubtask(task.id, newSubtask.trim());
                      setNewSubtask("");
                    });
                  }
                }}
                placeholder="أضف مهمة فرعية…"
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </section>

          {/* linked notes */}
          <section className="space-y-2">
            <h3 className="text-xs text-muted-foreground">الملاحظات المرتبطة</h3>
            {linkedNotes.map((n) => (
              <Link
                key={n.id}
                href={`/notes/${n.id}`}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent"
              >
                <NotebookText className="size-3.5 text-muted-foreground" />
                {n.title}
              </Link>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                startTransition(async () => {
                  const note = await createNote({ title: task.title, taskId: task.id });
                  router.push(`/notes/${note.id}`);
                })
              }
            >
              <Plus className="size-3.5" />
              ملاحظة جديدة
            </Button>
          </section>

          {/* footer actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                startTransition(async () => {
                  await toggleTask(task.id, !task.done);
                  close();
                })
              }
            >
              {task.done ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
              {task.done ? "إرجاعها مفتوحة" : "إنجاز المهمة"}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 3000);
                  return;
                }
                startTransition(async () => {
                  await deleteTask(task.id);
                  close();
                });
              }}
            >
              <Trash2 className="size-3.5" />
              {confirmDelete ? "متأكد؟ اضغط للحذف" : "حذف"}
            </Button>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-numeric>
            <CalendarDays className="size-3" />
            أُنشئت {new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium" }).format(task.createdAt)}
            {task.completedAt
              ? ` · أُنجزت ${new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium" }).format(task.completedAt)}`
              : null}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
