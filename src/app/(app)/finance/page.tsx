import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlaceholderCard } from "@/components/placeholder-card";

export const metadata: Metadata = { title: "المالية" };

export default function FinancePage() {
  return (
    <>
      <PageHeader
        title="الماليـــة"
        description="اشتراكاتك، التزاماتك، وقدرتك الشرائية — بالريال السعودي."
      />
      <PlaceholderCard label="لوحة المالية تُبنى في مرحلة لاحقة" />
    </>
  );
}
