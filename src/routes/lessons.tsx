import { createFileRoute } from "@tanstack/react-router";
import { IridologyChart } from "@/components/IridologyChart";

export const Route = createFileRoute("/lessons")({
  component: LessonsPage,
  head: () => ({
    meta: [
      { title: "Lessons — How to read the eye | IrisScope" },
      { name: "description", content: "Six practical iridology lessons drawn from Bernard Jensen and Henry Lindlahr: constitution, zones, rings, signs, color, and how to practice." },
      { property: "og:title", content: "Lessons — How to read the eye" },
      { property: "og:description", content: "Practical lessons on iris constitution, zones, rings, and signs, grounded in the classic texts." },
    ],
  }),
});

interface Lesson {
  n: number;
  title: string;
  source: string;
  body: string[];
  practice: string;
}

const LESSONS: Lesson[] = [
  {
    n: 1,
    title: "The constitution: what color is the iris?",
    source: "Bernard Jensen, Iridology Simplified",
    body: [
      "Jensen sorts irises into three families: lymphatic (blue), hematogenic (true brown), and biliary/mixed (greenish-hazel).",
      "Constitution is the starting frame — it tells you which weaknesses the person inherits a tendency toward, not what they currently suffer.",
      "Blue irises are said to show lymph & skin patterns most clearly; brown irises hide many signs and require stronger light.",
    ],
    practice: "In a mirror, classify your own iris in one of the three families. Note the overall hue, not just a small patch.",
  },
  {
    n: 2,
    title: "The clock: 12 sectors around the iris",
    source: "Composite of Jensen & Lindlahr",
    body: [
      "Imagine a clock face laid over the iris. Each hour corresponds to organs and body regions.",
      "Right iris maps the right side of the body; left iris the left side. The heart sign therefore appears only in the left iris (around 2–3 o'clock).",
      "12 o'clock = brain. 6 o'clock = kidney / pelvis. Liver sits at 7–8 o'clock in the right iris.",
    ],
    practice: "Hover the chart on the right. Try to recite the four cardinal positions (12, 3, 6, 9) without peeking.",
  },
  {
    n: 3,
    title: "Three concentric rings",
    source: "Bernard Jensen",
    body: [
      "The innermost band hugging the pupil is the stomach ring. Just outside it lies the autonomic nerve wreath, or collarette — the intestinal zone.",
      "The wide middle territory is the organ zone, mapped by the clock above.",
      "The outermost rings cover circulation, lymphatic flow, and skin. A dark outer band is the 'scurf rim' — a sign the skin isn't eliminating well.",
    ],
    practice: "On a close-up photo of an eye, trace the three rings with your finger. Note where the collarette is bumpy vs. smooth.",
  },
  {
    n: 4,
    title: "Signs: lacunae, nerve rings, pigments",
    source: "Henry Lindlahr, Iridiagnosis (1919, public domain)",
    body: [
      "A lacuna is a dark, lens-shaped opening in the fibers — Lindlahr called it a sign of inherent weakness in the underlying organ.",
      "Nerve rings are pale concentric arcs that look like ripples in a pond — historically interpreted as nervous tension or chronic stress.",
      "Pigment spots (yellow, brown, orange) sitting on top of the fibers were attributed to drug deposits or organ stress.",
    ],
    practice: "When you run the reader, watch the 'observations' panel: those tags map directly to lacuna / nerve-ring / pigment language.",
  },
  {
    n: 5,
    title: "Density: how 'tight' are the fibers?",
    source: "Jensen, Iridology Simplified",
    body: [
      "Tight, parallel fibers like satin — Jensen called this a strong constitution with high recuperative power.",
      "Loose, wavy fibers with visible gaps — a more delicate constitution; the person may tire faster and need slower healing protocols.",
      "Density is a global trait; you read it once, before drilling into zones.",
    ],
    practice: "Take two iris photos online — one tight, one loose — and try to spot the difference in 5 seconds each.",
  },
  {
    n: 6,
    title: "Reading a whole eye, in order",
    source: "Recommended workflow",
    body: [
      "1. Color/constitution. 2. Density. 3. Rings (collarette, scurf rim). 4. Clock zones with notable signs. 5. Pigments last.",
      "Always read both eyes — they cross-check each other. A sign in only one iris is regional; a sign in both is systemic.",
      "Document what you see in plain language. Resist the urge to 'diagnose' — note observations, then study them.",
    ],
    practice: "Open the Eye Reader, run a capture on each eye, and write down the top 3 findings per eye in your own words.",
  },
];

function LessonsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="mb-10 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl">How to read the eye</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Six short, practical lessons. The material is drawn from Bernard Jensen's{" "}
          <em>Iridology Simplified</em> and Henry Lindlahr's <em>Iridiagnosis</em> (1919, public
          domain). Treat the framework as a study of pattern — modern medicine does not validate it
          as diagnosis.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-12">
        <ol className="space-y-10">
          {LESSONS.map((l) => (
            <li key={l.n} className="bg-card border border-border rounded-2xl p-7 shadow-soft">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl text-primary">{String(l.n).padStart(2, "0")}</span>
                <h2 className="font-display text-2xl">{l.title}</h2>
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 ml-12">
                {l.source}
              </div>
              <div className="mt-5 ml-12 space-y-3 text-[15px] leading-relaxed text-foreground/90">
                {l.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-5 ml-12 bg-secondary/60 border-l-2 border-primary px-4 py-3 rounded">
                <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                  Practice
                </div>
                <div className="text-sm mt-1">{l.practice}</div>
              </div>
            </li>
          ))}
        </ol>

        <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
            <IridologyChart eye="right" size={280} />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            Reference chart — right iris. Switch to the left iris in the reader to see the mirrored
            mapping (heart at 2–3 o'clock).
          </div>
        </aside>
      </div>
    </main>
  );
}
