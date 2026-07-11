import { formatCount } from "@/lib/format";
import { dueLabel } from "@/lib/dates";
import type { PlatformPulse } from "@/lib/queries/stats";

/**
 * نبض المنصات — three read-only cards fed by machine snapshots
 * (StreamBot for Twitch/Discord, the VPS scraper for X). Monochrome by
 * design law; red appears only when the X session needs re-login.
 * The whole section renders nothing until the first data lands.
 */

const META = {
  twitch: { name: "Twitch", handle: "OYazan1", unit: "متابِع" },
  discord: { name: "Discord", handle: "السيرفر", unit: "عضو" },
  x: { name: "X", handle: "@POGYaz", unit: "متابِع" },
} as const;

type Props = {
  pulses: PlatformPulse[];
  xBroken: boolean;
  snapshotDay: string | null;
};

export function PlatformPulseStrip({ pulses, xBroken, snapshotDay }: Props) {
  const anyData = pulses.some((p) => p.latest || p.live);
  if (!anyData) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold">نبض المنصات</h2>
        {snapshotDay ? (
          <span className="text-[0.6875rem] text-muted-foreground" data-numeric>
            آخر لقطة: {dueLabel(snapshotDay)}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {pulses.map((p) => (
          <PulseCard key={p.platform} pulse={p} xBroken={xBroken} />
        ))}
      </div>
    </section>
  );
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function PulseCard({ pulse, xBroken }: { pulse: PlatformPulse; xBroken: boolean }) {
  const meta = META[pulse.platform];
  const m = pulse.latest?.metrics ?? {};
  const live = pulse.live ?? {};
  const broken = pulse.platform === "x" && xBroken;

  const mainKey = pulse.platform === "discord" ? "members" : "followers";
  const big = num(m[mainKey]) ?? num(live[mainKey]);

  const isLive = pulse.platform === "twitch" && live.live === true;
  const viewers = num(live.viewers);

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border px-5 py-4">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={pulse.platform} />
        <span className="text-[0.8125rem] font-bold">{meta.name}</span>
        <span className="text-xs text-muted-foreground" dir="ltr" data-numeric>
          {meta.handle}
        </span>
        {isLive ? (
          <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[0.6875rem] font-bold text-primary-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground motion-reduce:animate-none" />
            <span data-numeric>مباشر{viewers != null ? ` · ${formatCount(viewers)}` : ""}</span>
          </span>
        ) : null}
      </div>

      {broken ? (
        <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
          <WarnIcon />
          انقطعت جلسة X — أعد الربط من الخادم
        </div>
      ) : null}

      {big != null ? (
        <>
          <div className={broken ? "opacity-45" : undefined}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[1.75rem] leading-none font-bold" data-numeric>
                {formatCount(big)}
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">{meta.unit}</span>
            </div>
            <Delta pulse={pulse} broken={broken} />
          </div>
          <Spark series={pulse.series} dim={broken} />
          <Foot pulse={pulse} isLive={isLive} />
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
          لا بيانات بعد — أول لقطة الليلة
        </p>
      )}
    </div>
  );
}

function Delta({ pulse, broken }: { pulse: PlatformPulse; broken: boolean }) {
  if (broken && pulse.latest) {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground" data-numeric>
        آخر لقطة: {dueLabel(pulse.latest.day)}
      </p>
    );
  }
  if (pulse.weeklyDelta == null) {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">أول أسبوع — التاريخ يتجمع</p>
    );
  }
  const d = pulse.weeklyDelta;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground" data-numeric>
      {d !== 0 ? (
        <span className="text-[0.65rem] text-foreground">{d > 0 ? "▲" : "▼"}</span>
      ) : null}
      {d === 0 ? "ثابت هذا الأسبوع" : `${formatCount(Math.abs(d))} هذا الأسبوع`}
    </p>
  );
}

function Foot({ pulse, isLive }: { pulse: PlatformPulse; isLive: boolean }) {
  const m = pulse.latest?.metrics ?? {};
  const live = pulse.live ?? {};
  let start: string | null = null;
  let end: string | null = null;

  if (pulse.platform === "twitch") {
    const subs = num(m.subs);
    start = subs != null ? `${formatCount(subs)} مشترك` : null;
    end = isLive ? "آخر بث: الآن" : null;
  } else if (pulse.platform === "discord") {
    const online = num(live.online) ?? num(m.online);
    const voice = num(live.voice) ?? num(m.voice);
    start = online != null ? `${formatCount(online)} متصل الآن` : null;
    end = voice != null ? `${formatCount(voice)} صوتي` : null;
  } else {
    const posts = num(m.posts);
    const following = num(m.following);
    start = posts != null ? `${formatCount(posts)} منشور` : null;
    end = following != null ? `يتابع ${formatCount(following)}` : null;
  }

  if (!start && !end) return null;
  return (
    <div
      className="flex justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground"
      data-numeric
    >
      <span>{start}</span>
      <span>{end}</span>
    </div>
  );
}

/** Server-rendered monochrome sparkline. Time runs LTR even in the RTL page. */
function Spark({ series, dim }: { series: number[]; dim: boolean }) {
  if (series.length < 2) {
    return (
      <div className="flex h-11 items-center justify-center rounded-md border-[1.5px] border-dashed text-[0.6875rem] text-muted-foreground">
        الرسم يكتمل مع الأيام
      </div>
    );
  }
  const W = 300;
  const H = 44;
  const PAD = 3;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (series.length - 1);
  const y = (v: number) => H - PAD - ((v - min) * (H - 2 * PAD)) / (max - min || 1);
  const pts = series.map((v, i) => [x(i), y(v)] as const);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`;
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`h-11 w-full text-foreground ${dim ? "opacity-45" : ""}`}
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity={0.06} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r={3.4} fill="currentColor" stroke="var(--background)" strokeWidth={2} />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: keyof typeof META }) {
  const paths = {
    twitch:
      "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z",
    discord:
      "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z",
    x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  } as const;
  return (
    <svg viewBox="0 0 24 24" className="size-[15px] shrink-0 fill-foreground" aria-hidden>
      <path d={paths[platform]} />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[13px] shrink-0 fill-destructive" aria-hidden>
      <path d="M12 2 1 21h22zm1 14h-2v2h2zm0-7h-2v5h2z" />
    </svg>
  );
}
