import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlaceholderCard } from "@/components/placeholder-card";

export const metadata: Metadata = { title: "الملاحظات" };

export default function NotesPage() {
  return (
    <>
      <PageHeader
        title="الملاحظـــات"
        description="ملاحظاتك بصيغة ماركداون — مرتبطة بالمهام أو مستقلة."
      />
      <PlaceholderCard label="محرر الملاحظات يُبنى في المرحلة القادمة" />
    </>
  );
}
