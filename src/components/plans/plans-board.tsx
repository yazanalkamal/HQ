"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createPlan,
  deletePlan,
  promotePlan,
  updatePlan,
  type Bucket,
} from "@/app/(app)/plans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Plan } from "@/db/schema";

const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: "now", label: "الآن", hint: "ما تعمل عليه فعلًا" },
  { key: "next", label: "قريبًا", hint: "التالي في الطابور" },
  { key: "someday", label: "يومًا ما", hint: "أحلام وأفكار" },
];

export function PlansBoard({ plans }: { plans: Plan[] }) {
  const [editing, setEditing] = useState<Plan | null>(null);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {BUCKETS.map((b, i) => (
          <Column
            key={b.key}
            bucket={b}
            plans={plans.filter((p) => p.bucket === b.key)}
            canMoveStart={i > 0}
            canMoveEnd={i < BUCKETS.length - 1}
            startBucket={BUCKETS[i - 1]?.key}
            endBucket={BUCKETS[i + 1]?.key}
            onEdit={setEditing}
          />
        ))}
      </div>

      {editing ? <PlanSheet plan={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function Column({
  bucket,
  plans,
  canMoveStart,
  canMoveEnd,
  startBucket,
  endBucket,
  onEdit,
}: {
  bucket: (typeof BUCKETS)[number];
  plans: Plan[];
  canMoveStart: boolean;
  canMoveEnd: boolean;
  startBucket?: Bucket;
  endBucket?: Bucket;
  onEdit: (p: Plan) => void;
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  function add() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createPlan({ title: t, bucket: bucket.key });
      setTitle("");
    });
  }

  return (
    <section className="flex flex-col rounded-xl border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-bold">
          {bucket.label}
          {plans.length > 0 ? (
            <span className="ms-1.5 font-normal text-muted-foreground" data-numeric>
              ({plans.length})
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{bucket.hint}</p>
      </header>

      <div className="flex-1 space-y-1.5 p-2.5">
        {plans.map((p) => (
          <article
            key={p.id}
            className="group rounded-lg border bg-background p-3 transition-shadow hover:shadow-sm"
          >
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="w-full text-start text-sm font-medium"
            >
              {p.title}
            </button>
            {p.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
            ) : null}
            <CardActions
              plan={p}
              canMoveStart={canMoveStart}
              canMoveEnd={canMoveEnd}
              startBucket={startBucket}
              endBucket={endBucket}
            />
          </article>
        ))}

        {plans.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">فارغ.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t px-3.5 py-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="أضف خطة…"
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </section>
  );
}

function CardActions({
  plan,
  canMoveStart,
  canMoveEnd,
  startBucket,
  endBucket,
}: {
  plan: Plan;
  canMoveStart: boolean;
  canMoveEnd: boolean;
  startBucket?: Bucket;
  endBucket?: Bucket;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      {canMoveStart && startBucket ? (
        <IconBtn
          title="انقلها للعمود السابق"
          onClick={() =>
            startTransition(() => updatePlan({ id: plan.id, bucket: startBucket }))
          }
        >
          <ArrowRightToLine className="size-3.5" />
        </IconBtn>
      ) : null}
      {canMoveEnd && endBucket ? (
        <IconBtn
          title="انقلها للعمود التالي"
          onClick={() =>
            startTransition(() => updatePlan({ id: plan.id, bucket: endBucket }))
          }
        >
          <ArrowLeftToLine className="size-3.5" />
        </IconBtn>
      ) : null}
      <IconBtn
        title="حوّلها إلى مهمة"
        className="ms-auto gap-1 px-2 text-xs"
        onClick={() =>
          startTransition(async () => {
            const taskId = await promotePlan(plan.id);
            router.push(`/tasks?task=${taskId}`);
          })
        }
      >
        <ListTodo className="size-3.5" />
        مهمة
      </IconBtn>
    </div>
  );
}

function IconBtn({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PlanSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title="تفاصيل الخطة">
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">العنوان</span>
            <Input
              defaultValue={plan.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== plan.title)
                  startTransition(() => updatePlan({ id: plan.id, title: v }));
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">العمود</span>
            <div className="flex items-center rounded-lg border p-0.5">
              {BUCKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() =>
                    startTransition(() => updatePlan({ id: plan.id, bucket: b.key }))
                  }
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
                    plan.bucket === b.key
                      ? "bg-secondary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">التفاصيل</span>
            <Textarea
              defaultValue={plan.description}
              rows={5}
              placeholder="لماذا؟ كيف؟ متى تقريبًا؟…"
              onBlur={(e) => {
                if (e.target.value !== plan.description)
                  startTransition(() => updatePlan({ id: plan.id, description: e.target.value }));
              }}
            />
          </label>

          <div className="flex items-center justify-between border-t pt-4">
            <PromoteButton planId={plan.id} onDone={onClose} />
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
                  await deletePlan(plan.id);
                  onClose();
                });
              }}
            >
              <Trash2 className="size-3.5" />
              {confirmDelete ? "متأكد؟" : "حذف"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PromoteButton({ planId, onDone }: { planId: string; onDone: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      onClick={() =>
        startTransition(async () => {
          const taskId = await promotePlan(planId);
          onDone();
          router.push(`/tasks?task=${taskId}`);
        })
      }
    >
      <ListTodo className="size-3.5" />
      حوّلها إلى مهمة
    </Button>
  );
}
