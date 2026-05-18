interface StudySection {
  title: string;
  focus: string;
  notes: string[];
  practice: string;
}

const STUDY_SECTIONS: StudySection[] = [
  {
    title: "Purpose and Limits of Iris Study",
    focus: "Use the iris as a study map, not as a diagnosis.",
    notes: [
      "Jensen presents iridology as a way to observe inherited tendencies, tissue condition, and constitutional patterns.",
      "The safest learning posture is descriptive: record visible signs, compare both eyes, and avoid naming disease from an iris mark.",
      "A useful reading separates what is seen in the iris from any health claim made about the person.",
    ],
    practice:
      "Write observations with neutral wording such as color, density, ring, spot, or opening before adding any traditional interpretation.",
  },
  {
    title: "Constitutional Color",
    focus: "Begin with the broad iris color family.",
    notes: [
      "The classic Jensen framework starts with blue, brown, and mixed or biliary iris types.",
      "Color is treated as a constitutional background rather than a single finding. It influences how visible signs appear.",
      "Blue irises tend to show fiber and lymphatic-style signs more clearly, while brown irises may require brighter light and closer inspection.",
    ],
    practice: "Classify the iris color from a full-eye photo before zooming into individual signs.",
  },
  {
    title: "Density and Fiber Texture",
    focus: "Read the strength and openness of the iris fibers.",
    notes: [
      "Dense, orderly fibers are traditionally read as stronger constitutional reserve.",
      "Loose, wavy, or open fibers are interpreted as weaker tissue tone or slower recuperative power.",
      "Density is a whole-iris impression. It should be considered before isolated spots or zones.",
    ],
    practice:
      "Compare two iris photos side by side and describe only fiber tightness for the first pass.",
  },
  {
    title: "The Pupil and Stomach Ring",
    focus: "Study the innermost area around the pupil.",
    notes: [
      "The zone nearest the pupil is commonly associated with the stomach and digestive center.",
      "Changes in pupil shape, border tone, and the immediate surrounding ring are read before moving outward.",
      "A reading should distinguish pupil shape from iris-fiber signs; they are different observations.",
    ],
    practice:
      "Trace the pupil border and the first surrounding iris band, then note whether it appears even, dark, bright, or irregular.",
  },
  {
    title: "Collarette and Intestinal Zone",
    focus: "Inspect the autonomic wreath or collarette.",
    notes: [
      "The collarette is the boundary-like ring outside the stomach zone and is traditionally linked with the intestinal area.",
      "A smooth, even collarette is read differently from a jagged, distended, or contracted one.",
      "Its position and shape are often used as a visual anchor for the rest of the iris map.",
    ],
    practice:
      "Look for where the collarette is closest to and farthest from the pupil, then compare those clock positions.",
  },
  {
    title: "Clock Map and Organ Zones",
    focus: "Use clock positions to locate traditional body regions.",
    notes: [
      "The iris is read like a clock face, with the upper iris mapping head regions and lower iris mapping pelvis and lower-body regions.",
      "Right and left irises mirror the body sides. Some organs are emphasized more strongly in one iris.",
      "The clock map is a locating tool. It does not prove that a marked zone has a medical problem.",
    ],
    practice: "Memorize four anchors first: 12 o'clock, 3 o'clock, 6 o'clock, and 9 o'clock.",
  },
  {
    title: "Lacunae and Openings",
    focus: "Identify dark gaps or openings in the fibers.",
    notes: [
      "A lacuna is traditionally described as an opening or pocket in the iris fiber structure.",
      "Jensen-style readings treat the shape, depth, and location of the opening as important.",
      "Small isolated openings should be documented by clock position and ring depth rather than over-interpreted.",
    ],
    practice:
      "Mark each visible opening by clock hour and whether it sits near the pupil, middle organ zone, or outer rim.",
  },
  {
    title: "Rings, Arcs, and Stress Lines",
    focus: "Notice circular or partial circular markings.",
    notes: [
      "Concentric arcs are commonly discussed as nerve-ring or stress-ring patterns in classic iridology language.",
      "The number, depth, and completeness of arcs are all part of the traditional observation.",
      "Do not confuse eyelid shadows or photo glare with actual iris arcs.",
    ],
    practice:
      "Use even lighting and compare the same area across multiple photos before logging a ring as a finding.",
  },
  {
    title: "Pigments and Color Spots",
    focus: "Separate surface color marks from fiber structure.",
    notes: [
      "Pigment marks are traditionally read by color, size, sharpness, and zone location.",
      "Brown, orange, yellow, and dark spots are discussed differently in classic systems.",
      "A pigment should be recorded as a visible mark first, with any traditional meaning kept secondary.",
    ],
    practice:
      "Log pigment findings as color plus clock position, for example: brown mark near 4 o'clock, outer organ zone.",
  },
  {
    title: "Outer Rim and Elimination Zone",
    focus: "Study the perimeter of the iris.",
    notes: [
      "The outer rim is often connected with skin, lymph, circulation, and elimination language in Jensen-style charts.",
      "A darker or cloudy outer band is traditionally called a scurf-rim style observation.",
      "The outer rim can be affected by lighting, eyelids, lashes, and image focus, so photo quality matters.",
    ],
    practice:
      "Before recording an outer-rim sign, check whether the eyelid mask or shadow is covering that area.",
  },
  {
    title: "Putting a Reading in Order",
    focus: "Build a repeatable workflow.",
    notes: [
      "A practical order is: color, density, pupil, collarette, rings, clock-zone signs, pigments, and outer rim.",
      "Read both eyes and compare mirrored zones before deciding which signs are most important.",
      "The final note should be a visual study record, not a diagnosis or treatment plan.",
    ],
    practice:
      "Create a one-page worksheet with color, density, rings, top three zone findings, and photo-quality notes.",
  },
];

export function IridologySimplifiedLessons() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-2xl">Iridology Simplified study guide</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A chapter-style learning outline inspired by Bernard Jensen&apos;s iridology framework.
          This is original study material, not a verbatim reproduction of the book.
        </p>
      </div>

      <ol className="space-y-5">
        {STUDY_SECTIONS.map((section, index) => (
          <li
            key={section.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl">{section.title}</h3>
            </div>
            <p className="ml-10 mt-1 text-sm font-medium text-primary">{section.focus}</p>
            <div className="ml-10 mt-4 space-y-2 text-sm leading-relaxed text-foreground/90">
              {section.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <div className="ml-10 mt-4 rounded border-l-2 border-primary bg-secondary/60 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Practice
              </div>
              <p className="mt-1 text-sm">{section.practice}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
