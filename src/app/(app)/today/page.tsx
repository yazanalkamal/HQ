import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlaceholderCard } from "@/components/placeholder-card";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "اليوم" };

export default function TodayPage() {
  return (
    <>
      <PageHeader
        title="اليـــوم"
        description={formatDate(new Date())}
      />
      <PlaceholderCard label="لوحة اليوم تُبنى مع قسم المهام في المرحلة القادمة" />
    </>
  );
}
