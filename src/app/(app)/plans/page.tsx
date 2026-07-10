import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { PlansBoard } from "@/components/plans/plans-board";

export const metadata: Metadata = { title: "الخطط" };

export default async function PlansPage() {
  const allPlans = await db
    .select()
    .from(plans)
    .orderBy(asc(plans.sortOrder), asc(plans.createdAt));

  return (
    <>
      <PageHeader
        title="الخطـــط"
        description="الآن، قريبًا، ويومًا ما — وعندما تنضج الخطة حوّلها إلى مهمة."
      />
      <PlansBoard plans={allPlans} />
    </>
  );
}
