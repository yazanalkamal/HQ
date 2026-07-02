import type { Metadata } from "next";
import { thmanyahSans, thmanyahSerifDisplay, thmanyahSerifText } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "المقر",
    template: "%s — المقر",
  },
  description: "المقر الشخصي — مهام، ملاحظات، مالية، وخطط.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${thmanyahSans.variable} ${thmanyahSerifDisplay.variable} ${thmanyahSerifText.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
