import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlaceholderCard } from "@/components/placeholder-card";

export const metadata: Metadata = { title: "المهام" };

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="المهـــام"
        description="كل مهامك ومواعيدها النهائية في مكان واحد."
      />
      <PlaceholderCard label="قائمة المهام تُبنى في المرحلة القادمة" />
    </>
  );
}
