"use client";

import { useState, useTransition } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { createArea, deleteArea, updateArea } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AREA_COLORS, areaDotClass, type AreaColor } from "@/lib/areas";
import { cn } from "@/lib/utils";
import type { Area } from "@/db/schema";

export function AreasManager({ areas }: { areas: Area[] }) {
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<AreaColor>("gray");
  const [error, setError] = useState("");

  function add() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createArea({ name, color: newColor });
        setNewName("");
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر الإنشاء");
      }
    });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Settings2 className="size-3.5" />
          المجالات
        </Button>
      </SheetTrigger>
      <SheetContent title="المجالات">
        <div className="space-y-6">
          <div className="space-y-1">
            {areas.map((a) => (
              <AreaRow key={a.id} area={a} />
            ))}
            {areas.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                لا مجالات بعد — أنشئ أول مجال (شخصي، البث، الجامعة…)
              </p>
            ) : null}
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="مجال جديد…"
              />
              <Button size="icon" onClick={add} aria-label="إضافة">
                <Plus />
              </Button>
            </div>
            <ColorPicker value={newColor} onChange={setNewColor} />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AreaRow({ area }: { area: Area }) {
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="group flex items-center gap-2 rounded-lg px-1 py-1">
      <ColorDotMenu area={area} />
      <Input
        defaultValue={area.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== area.name)
            startTransition(() => updateArea(area.id, { name: v, color: area.color }));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 flex-1 border-none px-2 shadow-none"
      />
      <button
        type="button"
        aria-label="حذف المجال"
        onClick={() => {
          if (!confirm) {
            setConfirm(true);
            setTimeout(() => setConfirm(false), 3000);
            return;
          }
          startTransition(() => deleteArea(area.id));
        }}
        className={cn(
          "rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100",
          confirm && "text-destructive opacity-100",
        )}
        title={confirm ? "متأكد؟ المهام تبقى بدون مجال" : "حذف"}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function ColorDotMenu({ area }: { area: Area }) {
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="تغيير اللون"
        onClick={() => setOpen(!open)}
        className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
      >
        <span className={cn("size-3 rounded-full", areaDotClass(area.color))} />
      </button>
      {open ? (
        <div className="absolute start-0 top-8 z-10 flex gap-1 rounded-lg border bg-popover p-2 shadow-md">
          {(Object.keys(AREA_COLORS) as AreaColor[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={AREA_COLORS[c].label}
              onClick={() => {
                setOpen(false);
                startTransition(() => updateArea(area.id, { name: area.name, color: c }));
              }}
              className={cn(
                "flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110",
                area.color === c ? "border-foreground" : "border-transparent",
              )}
            >
              <span className={cn("size-3.5 rounded-full", AREA_COLORS[c].dot)} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: AreaColor;
  onChange: (c: AreaColor) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {(Object.keys(AREA_COLORS) as AreaColor[]).map((c) => (
        <button
          key={c}
          type="button"
          aria-label={AREA_COLORS[c].label}
          onClick={() => onChange(c)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
            value === c ? "border-foreground" : "border-transparent",
          )}
        >
          <span className={cn("size-4 rounded-full", AREA_COLORS[c].dot)} />
        </button>
      ))}
    </div>
  );
}
