import { useEffect, useRef, useState } from "react";
import { loadOpenCV } from "@/lib/opencv-loader";
import { IRIS_ZONES } from "@/lib/iridology-zones";
import { Camera, Loader2, ScanEye, AlertTriangle, CircleStop } from "lucide-react";

interface Detection {
  cx: number;
  cy: number;
  rIris: number;
  rPupil: number;
}

interface Finding {
  hour: number;
  zoneRight: string;
  zoneLeft: string;
  observation: string;
  confidence: number;
}

interface IrisReport {
  irisColor: string;
  dominantTone: string;
  ringObservations: string[];
  findings: Finding[];
}

type Eye = "right" | "left";

export function EyeReader() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cvReady, setCvReady] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [eye, setEye] = useState<Eye>("right");
  const [report, setReport] = useState<IrisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setCvLoading(true);
    loadOpenCV()
      .then(() => setCvReady(true))
      .catch((e) => setError(`OpenCV failed to load: ${e.message}`))
      .finally(() => setCvLoading(false));
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      requestAnimationFrame(detectLoop);
    } catch (e: any) {
      setError(`Camera access denied: ${e.message}. Allow camera permission and retry.`);
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
    setDetection(null);
  }

  function detectLoop() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !window.cv || v.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    const cv = window.cv;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);

    try {
      const src = cv.imread(c);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.medianBlur(gray, gray, 5);

      const circles = new cv.Mat();
      cv.HoughCircles(
        gray,
        circles,
        cv.HOUGH_GRADIENT,
        1,
        Math.max(40, gray.rows / 8),
        100,
        40,
        Math.floor(gray.rows * 0.08),
        Math.floor(gray.rows * 0.35),
      );

      let best: Detection | null = null;
      if (circles.cols > 0) {
        // pick largest plausible circle near center
        let bestScore = -Infinity;
        for (let i = 0; i < circles.cols; i++) {
          const cx = circles.data32F[i * 3];
          const cy = circles.data32F[i * 3 + 1];
          const r = circles.data32F[i * 3 + 2];
          const distFromCenter = Math.hypot(cx - c.width / 2, cy - c.height / 2);
          const score = r - distFromCenter * 0.3;
          if (score > bestScore) {
            bestScore = score;
            best = { cx, cy, rIris: r, rPupil: r * 0.35 };
          }
        }
      }

      // draw overlay
      if (best) {
        ctx.strokeStyle = "#6BCB77";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(best.cx, best.cy, best.rIris, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#EAF7EF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(best.cx, best.cy, best.rPupil, 0, Math.PI * 2);
        ctx.stroke();
        // 12 sector lines
        ctx.strokeStyle = "rgba(234,247,239,0.5)";
        ctx.lineWidth = 1;
        for (let h = 0; h < 12; h++) {
          const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(best.cx + Math.cos(a) * best.rPupil, best.cy + Math.sin(a) * best.rPupil);
          ctx.lineTo(best.cx + Math.cos(a) * best.rIris, best.cy + Math.sin(a) * best.rIris);
          ctx.stroke();
        }
        setDetection(best);
      } else {
        setDetection(null);
      }

      src.delete();
      gray.delete();
      circles.delete();
    } catch (e) {
      // swallow per-frame OpenCV errors
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  async function analyzeIris() {
    if (!detection || !canvasRef.current || !window.cv) return;
    setAnalyzing(true);
    const cv = window.cv;
    const c = canvasRef.current;
    const { cx, cy, rIris, rPupil } = detection;

    try {
      // crop iris region from a fresh frame (without overlay)
      const v = videoRef.current!;
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      tmp.getContext("2d")!.drawImage(v, 0, 0);
      const src = cv.imread(tmp);

      // mean color over iris annulus
      const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
      cv.circle(mask, new cv.Point(cx, cy), Math.floor(rIris), new cv.Scalar(255), -1);
      cv.circle(mask, new cv.Point(cx, cy), Math.floor(rPupil), new cv.Scalar(0), -1);
      const mean = cv.mean(src, mask);
      const [r, g, b] = [mean[0], mean[1], mean[2]];
      const irisColor = classifyColor(r, g, b);
      const dominantTone = toneDescription(r, g, b);

      // Convert to gray and inspect per-sector darkness/variance for "lacunae" hints
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      const findings: Finding[] = [];
      const overallMean = cv.mean(gray, mask)[0];

      for (const z of IRIS_ZONES) {
        const centerAngle = ((z.hour - 1) / 12) * 360 - 90;
        const a0 = ((centerAngle - 15) * Math.PI) / 180;
        const a1 = ((centerAngle + 15) * Math.PI) / 180;
        // sample points inside this wedge
        let sum = 0;
        let sumSq = 0;
        let n = 0;
        for (let radPct = 0.4; radPct < 0.95; radPct += 0.08) {
          for (let aStep = 0; aStep <= 4; aStep++) {
            const a = a0 + ((a1 - a0) * aStep) / 4;
            const rr = rPupil + (rIris - rPupil) * radPct;
            const px = Math.round(cx + Math.cos(a) * rr);
            const py = Math.round(cy + Math.sin(a) * rr);
            if (px < 0 || py < 0 || px >= gray.cols || py >= gray.rows) continue;
            const val = gray.ucharPtr(py, px)[0];
            sum += val;
            sumSq += val * val;
            n++;
          }
        }
        if (n === 0) continue;
        const m = sum / n;
        const variance = sumSq / n - m * m;
        const darkness = (overallMean - m) / Math.max(overallMean, 1);
        let observation = "Uniform fibers — no remarkable features.";
        let confidence = 0.2;
        if (darkness > 0.18) {
          observation = "Darker patch detected — classically read as a 'lacuna' / weakened tissue sign.";
          confidence = Math.min(0.85, darkness * 2);
        } else if (variance > 900) {
          observation = "High fiber irregularity — Lindlahr's 'nerve ring' or stress pattern.";
          confidence = Math.min(0.75, variance / 1800);
        } else if (darkness < -0.15) {
          observation = "Brighter zone — Jensen associates with acute / inflamed activity.";
          confidence = Math.min(0.7, -darkness * 2);
        }
        findings.push({
          hour: z.hour,
          zoneRight: z.rightEye,
          zoneLeft: z.leftEye,
          observation,
          confidence,
        });
      }

      // ring observations
      const ringObservations: string[] = [];
      const outerMask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
      cv.circle(outerMask, new cv.Point(cx, cy), Math.floor(rIris), new cv.Scalar(255), -1);
      cv.circle(outerMask, new cv.Point(cx, cy), Math.floor(rIris * 0.85), new cv.Scalar(0), -1);
      const outerMean = cv.mean(src, outerMask);
      if (outerMean[0] + outerMean[1] + outerMean[2] < (r + g + b) * 0.75) {
        ringObservations.push("Darker outer ring — historically called a 'scurf rim' (skin elimination zone).");
      }
      if (b > r * 1.05 && b > g * 1.05) {
        ringObservations.push("Bluish cast — Jensen's 'lymphatic constitution'.");
      } else if (r > b * 1.1) {
        ringObservations.push("Warm reddish-brown cast — Jensen's 'hematogenic / mixed constitution'.");
      }
      outerMask.delete();

      setReport({
        irisColor,
        dominantTone,
        ringObservations,
        findings: findings.sort((a, b) => b.confidence - a.confidence),
      });

      src.delete();
      gray.delete();
      mask.delete();
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
      <div className="space-y-4">
        <div className="relative rounded-2xl overflow-hidden bg-deep shadow-soft aspect-video">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="w-full h-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground gap-3 bg-deep/90">
              {cvLoading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm opacity-80">Loading OpenCV vision engine…</p>
                </>
              ) : (
                <>
                  <ScanEye className="h-10 w-10" />
                  <p className="text-sm opacity-80">Camera off</p>
                </>
              )}
            </div>
          )}
          {camOn && detection && (
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium">
              Iris locked · r={Math.round(detection.rIris)}px
            </div>
          )}
          {camOn && !detection && (
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground">
              Searching for iris… get closer, eye centered
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {!camOn ? (
            <button
              onClick={startCamera}
              disabled={!cvReady}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium shadow-soft hover:brightness-110 transition disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Start camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-secondary/80 transition"
            >
              <CircleStop className="h-4 w-4" /> Stop
            </button>
          )}
          <button
            onClick={analyzeIris}
            disabled={!detection || analyzing}
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-lg font-medium shadow-glow hover:brightness-110 transition disabled:opacity-40 disabled:shadow-none"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
            Read this iris
          </button>
          <div className="flex bg-secondary rounded-lg p-1 text-xs">
            {(["right", "left"] as Eye[]).map((e) => (
              <button
                key={e}
                onClick={() => setEye(e)}
                className={`px-3 py-1.5 rounded-md transition ${
                  eye === e ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {e[0].toUpperCase() + e.slice(1)} eye
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex gap-2 items-start text-sm bg-destructive/10 text-destructive border border-destructive/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Tip: bright, even lighting; hold the eye 15–25cm from the camera; look slightly to the side
          to reduce glare. Detection uses Hough Circle Transform on each frame.
        </p>
      </div>

      <aside className="space-y-4">
        <h2 className="font-display text-2xl">Reading</h2>
        {!report && (
          <p className="text-sm text-muted-foreground">
            No reading yet. Lock onto an iris, then press <em>Read this iris</em>. The analysis runs
            entirely in your browser — no frames leave your device.
          </p>
        )}
        {report && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-soft">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Iris color</div>
              <div className="font-display text-xl">{report.irisColor}</div>
              <div className="text-sm text-muted-foreground mt-1">{report.dominantTone}</div>
            </div>

            {report.ringObservations.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Constitution & rings
                </div>
                <ul className="space-y-1.5 text-sm">
                  {report.ringObservations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-1.5">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Zone observations ({eye} eye mapping)
              </div>
              <ul className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {report.findings.slice(0, 8).map((f) => (
                  <li
                    key={f.hour}
                    className="bg-card border border-border rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {f.hour}h · {eye === "right" ? f.zoneRight : f.zoneLeft}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        conf {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1">{f.observation}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-3 leading-relaxed">
              These observations follow the traditional iridology framework of Bernard Jensen and Henry
              Lindlahr. They are <strong>not a medical diagnosis</strong>. Consult a licensed clinician
              for health concerns.
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function classifyColor(r: number, g: number, b: number): string {
  if (b > r && b > g && b - r > 15) return "Blue / lymphatic";
  if (r > b && r - b > 25 && g > b) return "Brown / hematogenic";
  if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15) return "Grey / mixed";
  if (g > r && g > b) return "Hazel-green / biliary";
  return "Mixed / intermediate";
}

function toneDescription(r: number, g: number, b: number): string {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 70) return "Deep, low-light reading — try brighter ambient lighting.";
  if (lum > 200) return "Very bright — possible glare washing out fiber detail.";
  return `Tone balance R${Math.round(r)} G${Math.round(g)} B${Math.round(b)}.`;
}
