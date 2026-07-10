"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import {
  createCommitment,
  deleteCommitment,
  setMonthlyIncome,
  updateCommitment,
} from "@/app/(app)/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RIYAL, formatSAR } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CommitmentRow } from "@/lib/queries/finance";

export function CommitmentsSection({
  commitments,
  income,
}: {
  commitments: CommitmentRow[];
  income: number;
}) {
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState(String(income || ""));

  function addCommitment() {
    const name = newName.trim();
    const amount = Number(newAmount);
    if (!name || !(amount > 0)) return;
    startTransition(async () => {
      await createCommitment({ name, amount });
      setNewName("");
      setNewAmount("");
    });
  }

  function saveIncome() {
    const v = Number(incomeDraft);
    if (!Number.isFinite(v) || v < 0) return;
    startTransition(async () => {
      await setMonthlyIncome(v);
      setEditingIncome(false);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">الدخل والالتزامات الثابتة</h2>

      <div className="divide-y rounded-xl border">
        {/* income row */}
        <div className="flex items-center gap-4 px-5 py-3.5">
          <p className="flex-1 text-sm font-medium">الدخل الشهري</p>
          {editingIncome ? (
            <div className="flex items-center gap-2">
              <Input
                inputMode="decimal"
                value={incomeDraft}
                onChange={(e) => setIncomeDraft(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveIncome()}
                className="h-8 w-32 text-end"
                data-numeric
                autoFocus
              />
              <Button size="sm" onClick={saveIncome}>
                حفظ
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIncomeDraft(String(income || ""));
                setEditingIncome(true);
              }}
              className="group flex items-center gap-2 text-sm font-medium"
              data-numeric
            >
              {income > 0 ? (
                formatSAR(income)
              ) : (
                <span className="text-muted-foreground">حدّد دخلك</span>
              )}
              <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* commitments */}
        {commitments.map((c) => (
          <CommitmentLine key={c.id} c={c} />
        ))}

        {/* add row */}
        <div className="flex items-center gap-2 px-5 py-2.5">
          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCommitment()}
            placeholder="التزام ثابت (إيجار، عائلة…)"
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <input
            inputMode="decimal"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && addCommitment()}
            placeholder={`0 ${RIYAL}`}
            className="h-8 w-24 bg-transparent text-end text-sm outline-none placeholder:text-muted-foreground"
            data-numeric
          />
        </div>
      </div>
    </section>
  );
}

function CommitmentLine({ c }: { c: CommitmentRow }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [amount, setAmount] = useState(String(c.amount));
  const [confirm, setConfirm] = useState(false);

  function save() {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !(a > 0)) return;
    startTransition(async () => {
      await updateCommitment(c.id, { name: n, amount: a });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" autoFocus />
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-8 w-24 text-end"
          data-numeric
        />
        <Button size="sm" onClick={save}>
          حفظ
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-4 px-5 py-3">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 truncate text-start text-sm"
      >
        {c.name}
      </button>
      <span className="text-sm" data-numeric>
        {formatSAR(c.amount)}
      </span>
      <button
        type="button"
        aria-label="حذف"
        onClick={() => {
          if (!confirm) {
            setConfirm(true);
            setTimeout(() => setConfirm(false), 3000);
            return;
          }
          startTransition(() => deleteCommitment(c.id));
        }}
        className={cn(
          "rounded p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100",
          confirm && "text-destructive opacity-100",
        )}
        title={confirm ? "متأكد؟" : "حذف"}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
