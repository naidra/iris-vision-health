import { createFileRoute, Link } from "@tanstack/react-router";
import { IridologyChart } from "@/components/IridologyChart";
import { ScanEye, BookOpen, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "IrisScope — Read the iris in your browser" },
      {
        name: "description",
        content:
          "Detect your iris with local OpenCV.js in the browser, explore the traditional iridology zone map, and study the classic readings from Jensen & Lindlahr.",
      },
    ],
  }),
});

function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
      <section className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-secondary/70 text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> 100% in-browser · no upload, no server
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mt-5">
            See what classical <span className="text-primary">iridology</span> reads in your iris.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
            IrisScope locks onto your iris with local OpenCV.js, overlays the 12-sector chart from
            Bernard Jensen's <em>Iridology Simplified</em>, and surfaces observations grounded in
            Henry Lindlahr's <em>Iridiagnosis</em>. Built for study — not diagnosis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/reader"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-soft hover:brightness-110 transition"
            >
              <ScanEye className="h-4 w-4" /> Open the eye reader
            </Link>
            <Link
              to="/lessons"
              className="inline-flex items-center gap-2 bg-card border border-border px-6 py-3 rounded-xl font-medium hover:bg-secondary transition"
            >
              <BookOpen className="h-4 w-4" /> Start lessons
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
            {[
              { k: "12", v: "Clock-position zones mapped per iris" },
              { k: "3", v: "Concentric rings: stomach, collarette, organ" },
              { k: "0", v: "Bytes leave your device" },
            ].map((s) => (
              <div key={s.k}>
                <div className="font-display text-3xl text-primary">{s.k}</div>
                <div className="text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 -z-10 blur-3xl rounded-full bg-vital/30" />
          <div className="bg-card border border-border rounded-3xl p-8 shadow-soft">
            <IridologyChart eye="right" size={360} />
          </div>
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: ScanEye,
            title: "OpenCV iris lock",
            body: "A local OpenCV.js worker runs Hough Circle detection on webcam frames, then overlays the 12 traditional sectors live.",
          },
          {
            icon: BookOpen,
            title: "Jensen + Lindlahr",
            body: "Zone mappings, ring names ('scurf rim', 'nerve rings', 'lacunae') and constitution types come straight from the classic texts.",
          },
          {
            icon: ShieldCheck,
            title: "Privacy by design",
            body: "Your camera stream never leaves the browser. There is no backend, no logging, no upload. Stop the camera and it's gone.",
          },
        ].map((c) => (
          <div key={c.title} className="bg-card border border-border rounded-2xl p-6 shadow-soft">
            <c.icon className="h-6 w-6 text-primary" />
            <h3 className="font-display text-xl mt-3">{c.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
