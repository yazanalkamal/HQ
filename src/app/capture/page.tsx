import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TaskComposer } from "@/components/tasks/task-composer";
import { getCurrentSession } from "@/lib/auth";
import { plansForPicker } from "@/lib/queries/plans";
import { listAreas } from "@/lib/queries/tasks";

export const metadata: Metadata = { title: "إضافة سريعة" };

/**
 * The desktop shell's quick-add window (Ctrl+Shift+A anywhere in Windows):
 * nothing but the task composer on a transparent page — the native window
 * behind it paints no chrome. Lives outside the (app) layout on purpose:
 * no sidebar, no palette, no shell.
 */
export default async function CapturePage() {
  // same real check as the (app) layout — the edge proxy only sniffed the cookie
  const { session } = await getCurrentSession();
  if (!session) redirect("/signin");

  const [areas, pickerPlans] = await Promise.all([listAreas(), plansForPicker()]);

  return (
    <div data-capture-shell>
      <Suspense>
        <TaskComposer variant="capture" areas={areas} plans={pickerPlans} />
      </Suspense>
    </div>
  );
}
