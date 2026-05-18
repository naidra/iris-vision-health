import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About & disclaimer — IrisScope" },
      {
        name: "description",
        content:
          "About IrisScope: the iridology references it uses, how the in-browser vision pipeline works, and the medical disclaimer.",
      },
      { property: "og:title", content: "About & disclaimer — IrisScope" },
      {
        property: "og:description",
        content: "How IrisScope works and why it is an educational tool, not a medical diagnosis.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24 prose-tight">
      <h1 className="font-display text-4xl md:text-5xl">About IrisScope</h1>

      <div className="mt-8 bg-destructive/10 border border-destructive/30 rounded-xl p-5 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm text-foreground leading-relaxed">
          <strong className="text-destructive">Medical disclaimer.</strong> Iridology is{" "}
          <em>not</em> recognized by mainstream evidence-based medicine. Controlled studies have
          repeatedly failed to show that iris features reliably predict disease. IrisScope exists as
          a study tool for the classical iridology tradition — never use it to diagnose, treat, or
          replace consultation with a qualified clinician.
        </div>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl">How it works</h2>
        <p className="text-foreground/90">
          The app loads a vendored OpenCV.js build from this project and runs it locally in the
          browser. Your chosen eye image is drawn to a local canvas and processed in your tab:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 text-foreground/90">
          <li>OpenCV grayscale conversion and median blur reduce image noise.</li>
          <li>OpenCV's Hough Circle Transform locates the iris and estimates the pupil.</li>
          <li>
            The annular iris region is sampled in 12 wedges; mean intensity and variance per wedge
            feed simple heuristics for "darker patch", "high irregularity", and "brighter zone".
          </li>
          <li>Average RGB across the iris classifies the constitutional color family.</li>
        </ol>
        <p className="text-foreground/90">
          All processing runs inside your tab. There is no server, no upload, and no analytics.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl">Sources</h2>
        <ul className="space-y-2 text-foreground/90">
          <li>
            <strong>Bernard Jensen</strong> — <em>Iridology Simplified</em>. The composite 12-sector
            chart and the names of the rings (stomach ring, autonomic wreath, scurf rim) follow
            Jensen's convention.
          </li>
          <li>
            <strong>Henry Lindlahr</strong> — <em>Iridiagnosis and Other Diagnostic Methods</em>{" "}
            (1919, public domain). The language of "lacunae", "nerve rings", and pigment signs in
            the reader and lessons is drawn from Lindlahr's work.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl">Privacy</h2>
        <p className="text-foreground/90">
          The selected image is processed only inside your browser tab. The page contains no
          third-party trackers.
        </p>
      </section>

      <div className="mt-12">
        <Link to="/reader" className="text-primary font-medium underline">
          ← Try the eye reader
        </Link>
      </div>
    </main>
  );
}
