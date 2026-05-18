import { createFileRoute } from "@tanstack/react-router";
import { EyeReader } from "@/components/EyeReader";

export const Route = createFileRoute("/reader")({
  component: ReaderPage,
  head: () => ({
    meta: [
      { title: "Eye Reader — IrisScope" },
      {
        name: "description",
        content:
          "Choose an eye image and use local OpenCV.js to detect your iris and explore traditional iridology zone readings — all in your browser.",
      },
      { property: "og:title", content: "Eye Reader — IrisScope" },
      {
        property: "og:description",
        content:
          "Browser-only iris detection with local OpenCV.js and the classical iridology zone map.",
      },
    ],
  }),
});

function ReaderPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Eye reader</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Choose a bright, close-up eye image, fine-tune the detected iris overlay, then run the
          reading. Everything runs locally with the project's OpenCV.js files — no image leaves your
          device.
        </p>
      </header>
      <EyeReader />
    </main>
  );
}
