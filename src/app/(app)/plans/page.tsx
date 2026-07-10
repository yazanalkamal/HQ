import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlansView } from "@/components/plans/plans-view";
import { WeeklyReview } from "@/components/plans/weekly-review";
import { listActivePlans, listIdeas } from "@/lib/queries/plans";
import { timelineWindow } from "@/lib/timeline";

export const metadata: Metadata = { title: "الخطط" };

export default async function PlansPage() {
  const win = timelineWindow();
  const [ideas, plans] = await Promise.all([listIdeas(), listActivePlans(win)]);

  return (
    <>
      <PageHeader
        title="الخطـــط"
        description="خارطة الزمن — خططك مرسومة على الأسابيع، لا مكدّسة في قوائم."
        actions={<WeeklyReview ideas={ideas} plans={plans} win={win} />}
      />
      <PlansView ideas={ideas} plans={plans} win={win} />
    </>
  );
}
