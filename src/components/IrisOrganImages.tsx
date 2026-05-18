export function IrisOrganImages() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-2xl">Iris organ images</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Traditional organ-zone placement for the right and left iris. This is an educational map,
          not a medical diagnostic chart.
        </p>
      </div>

      <figure className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <img
          src={`${import.meta.env.BASE_URL}images/iridology.jpg`}
          alt="Iridology chart showing left and right iris organ zones."
          className="h-auto w-full rounded-lg border border-border bg-background"
          loading="lazy"
        />
        <figcaption className="mt-3 text-center text-sm font-medium">
          Iridology organ-zone chart
        </figcaption>
      </figure>
    </div>
  );
}
