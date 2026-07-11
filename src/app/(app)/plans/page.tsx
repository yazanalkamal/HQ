import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NewPlanButton, PlansViewToggle } from "@/components/plans/plans-header-controls";
import { PlansView } from "@/components/plans/plans-view";
import { WeeklyReview } from "@/components/plans/weekly-review";
import { listActivePlans, listIdeas, listInactivePlans } from "@/lib/queries/plans";
import { timelineWindow } from "@/lib/timeline";

export const metadata: Metadata = { title: "الخطط" };

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view: "cards" | "map" = params.view === "map" ? "map" : "cards";
  const win = timelineWindow();
  const [ideas, plans, inactive] = await Promise.all([
    listIdeas(),
    listActivePlans(win),
    listInactivePlans(),
  ]);

  return (
    <>
      <PageHeader
        title="الخطـــط"
        description="قمرة القيادة — كل خطة، وخطوتها القادمة."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <PlansViewToggle view={view} />
            <WeeklyReview ideas={ideas} plans={plans} win={win} />
            <NewPlanButton />
          </div>
        }
      />
      <PlansView ideas={ideas} plans={plans} inactive={inactive} win={win} view={view} />
    </>
  );
}
