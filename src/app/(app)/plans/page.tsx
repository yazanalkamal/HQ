import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlaceholderCard } from "@/components/placeholder-card";

export const metadata: Metadata = { title: "الخطط" };

export default function PlansPage() {
  return (
    <>
      <PageHeader
        title="الخطـــط"
        description="الآن، لاحقًا، ويومًا ما — خارطة ما هو قادم."
      />
      <PlaceholderCard label="لوحة الخطط تُبنى في مرحلة لاحقة" />
    </>
  );
}
