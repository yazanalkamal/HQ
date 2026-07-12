/** Tiny UA describer for the admin sessions list — label only, no logic. */
export function describeUserAgent(ua: string): string {
  if (!ua) return "جهاز غير معروف";

  const browser = ua.includes("HQDesktop/")
    ? "تطبيق المقر"
    : ua.includes("Edg/")
    ? "Edge"
    : ua.includes("OPR/")
      ? "Opera"
      : ua.includes("Chrome/")
        ? "Chrome"
        : ua.includes("Firefox/")
          ? "Firefox"
          : ua.includes("Safari/")
            ? "Safari"
            : "متصفح";

  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("iPhone")
      ? "iPhone"
      : ua.includes("iPad")
        ? "iPad"
        : ua.includes("Android")
          ? "Android"
          : ua.includes("Mac OS")
            ? "macOS"
            : ua.includes("Linux")
              ? "Linux"
              : "جهاز";

  return `${browser} · ${os}`;
}
