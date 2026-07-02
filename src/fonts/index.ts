import localFont from "next/font/local";

/**
 * Thmanyah Sans — UI and body text.
 * Weights: Light 300, Regular 400, Medium 500, Bold 700, Black 900.
 */
export const thmanyahSans = localFont({
  src: [
    { path: "./thmanyahsans-Light.woff2", weight: "300", style: "normal" },
    { path: "./thmanyahsans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./thmanyahsans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./thmanyahsans-Bold.woff2", weight: "700", style: "normal" },
    { path: "./thmanyahsans-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-sans-thmanyah",
  display: "swap",
});

/**
 * Thmanyah Serif Display — large headings only (the tatweel "ـ" stretch
 * is part of the visual identity: e.g. المهـــام). Never for body text.
 */
export const thmanyahSerifDisplay = localFont({
  src: [
    { path: "./thmanyahserifdisplay-Light.woff2", weight: "300", style: "normal" },
    { path: "./thmanyahserifdisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./thmanyahserifdisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./thmanyahserifdisplay-Bold.woff2", weight: "700", style: "normal" },
    { path: "./thmanyahserifdisplay-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-display-thmanyah",
  display: "swap",
});

/**
 * Thmanyah Serif Text — long-form reading (notes rendering).
 */
export const thmanyahSerifText = localFont({
  src: [
    { path: "./thmanyahseriftext-Light.woff2", weight: "300", style: "normal" },
    { path: "./thmanyahseriftext-Regular.woff2", weight: "400", style: "normal" },
    { path: "./thmanyahseriftext-Medium.woff2", weight: "500", style: "normal" },
    { path: "./thmanyahseriftext-Bold.woff2", weight: "700", style: "normal" },
    { path: "./thmanyahseriftext-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-serif-thmanyah",
  display: "swap",
});
