/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChangeEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import { Loader2, ScanEye, AlertTriangle, ImagePlus, HelpCircle } from "lucide-react";
import { useOpenCv } from "@/hooks/useOpenCv";

interface Detection {
  cx: number;
  cy: number;
  rIris: number;
  rPupil: number;
}

interface EyelidMask {
  topOffset: number;
  bottomOffset: number;
}

interface Finding {
  hour: number;
  zoneRight: string;
  zoneLeft: string;
  observation: string;
  confidence: number;
  spot?: CanvasPoint;
}

interface IrisReport {
  irisColor: string;
  dominantTone: string;
  ringObservations: string[];
  findings: Finding[];
}

type Eye = "right" | "left";
type PointerSide = "left" | "right";
type DragMode = "move" | "resize" | "resizePupil" | "upperLid" | "lowerLid";
type CanvasPoint = { x: number; y: number };

const MAX_DISPLAY_WIDTH = 960;
const IRIS_HANDLE_SIZE = 14;
const PUPIL_HANDLE_SIZE = 11;
const EYELID_HANDLE_SIZE = 12;
const HANDLE_HIT_MULTIPLIER = 3.4;
const EYELID_HANDLE_HIT_SIZE = 40;
const EYELID_LINE_HIT_SIZE = 44;
const EYELID_LINE_HIT_RADIUS_RATIO = 0.12;
const EYELID_MIN_GAP = 0.18;
const EYELID_OFFSET_MIN = -1.05;
const EYELID_OFFSET_MAX = 1.05;
const DEFAULT_EYELID_MASK: EyelidMask = { topOffset: -0.72, bottomOffset: 0.78 };

export function EyeReader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectionRef = useRef<Detection | null>(null);
  const eyelidMaskRef = useRef<EyelidMask>(DEFAULT_EYELID_MASK);
  const sourceImageDataRef = useRef<ImageData | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const { ready: openCvReady, loading: openCvLoading, error: openCvError } = useOpenCv();
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [eye, setEye] = useState<Eye>("right");
  const [report, setReport] = useState<IrisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [eyelidMask, setEyelidMask] = useState<EyelidMask>(DEFAULT_EYELID_MASK);
  const [pointerSide, setPointerSide] = useState<PointerSide | null>(null);
  const displayedError = error ?? openCvError;
  const autoDetectionRef = useRef<Detection | null>(null);

  function updateEyelidMask(nextMask: EyelidMask) {
    eyelidMaskRef.current = nextMask;
    setEyelidMask(nextMask);
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    try {
      setError(null);
      setImageLoading(true);
      setAnalyzing(false);
      setReport(null);
      setDetection(null);
      updateEyelidMask(DEFAULT_EYELID_MASK);
      setPointerSide(null);
      detectionRef.current = null;
      const image = await fileToImage(file);
      drawImageToCanvas(image);
      setImageReady(true);
      // Let the loader paint before synchronous OpenCV work starts.
      await waitForLoaderPaint();
      await processCanvasImage();
    } catch (e: any) {
      setError(`Image failed to load: ${e.message}`);
    } finally {
      setImageLoading(false);
      setAnalyzing(false);
    }
  }

  function drawImageToCanvas(image: HTMLImageElement) {
    const c = canvasRef.current;
    if (!c) return;
    const scale = Math.min(1, MAX_DISPLAY_WIDTH / image.naturalWidth);
    const displayW = Math.round(image.naturalWidth * scale);
    const displayH = Math.round(image.naturalHeight * scale);

    c.width = displayW;
    c.height = displayH;
    c.style.width = `${displayW}px`;
    c.style.height = "auto";

    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(image, 0, 0, displayW, displayH);
  }

  function createManualDetectionFallback(width: number, height: number): Detection {
    const r = Math.min(width, height) * 0.2;
    return {
      cx: width / 2,
      cy: height / 2,
      rIris: r,
      rPupil: r * 0.35,
    };
  }

  function applyDetection(nextDetection: Detection | null) {
    if (!nextDetection) return;
    setDetection(nextDetection);
    detectionRef.current = nextDetection;
    redrawSourceWithOverlay(nextDetection);
  }

  function updateDetectionByDrag(nextDetection: Detection) {
    setReport(null);
    applyDetection(nextDetection);
    if (autoDetectionRef.current) setError(null);
  }

  function resetDetection() {
    const source = sourceImageDataRef.current;
    if (!source) return;
    const next =
      autoDetectionRef.current ?? createManualDetectionFallback(source.width, source.height);
    updateEyelidMask(DEFAULT_EYELID_MASK);
    setPointerSide(null);
    setReport(null);
    setDetection(next);
    detectionRef.current = next;
    redrawSourceWithOverlay(next, DEFAULT_EYELID_MASK);
    if (autoDetectionRef.current) setError(null);
  }

  async function processCanvasImage() {
    const c = canvasRef.current;
    if (!c) return;
    if (!openCvReady || !window.cv) {
      setError("OpenCV is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      setAnalyzing(true);
      setReport(null);
      setError(null);
      const context = c.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      const imageData = context.getImageData(0, 0, c.width, c.height);
      sourceImageDataRef.current = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height,
      );
      setImageReady(true);

      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const nextDetection = detectIrisInCv(window.cv, imageData);

      if (!nextDetection) {
        setError("No iris detected automatically. Adjust the overlay manually.");
        autoDetectionRef.current = null;
        const fallback = createManualDetectionFallback(imageData.width, imageData.height);
        applyDetection(fallback);
        return;
      }

      setError(null);
      autoDetectionRef.current = nextDetection;
      applyDetection(nextDetection);
    } catch (e: any) {
      setError(`Detection failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyzeIris() {
    if (!detection || !sourceImageDataRef.current) return;
    if (!openCvReady || !window.cv) {
      setError("OpenCV is still loading. Please wait a moment.");
      return;
    }
    setAnalyzing(true);

    try {
      const source = sourceImageDataRef.current;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const imageData = new ImageData(
        new Uint8ClampedArray(source.data),
        source.width,
        source.height,
      );
      const report = analyzeIrisInCv(window.cv, imageData, detection, eyelidMask);
      setReport(report);
      redrawSourceWithOverlay(detection, eyelidMask, report);
      setError(null);
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  function redrawSourceWithOverlay(
    currentDetection: Detection | null,
    currentEyelidMask = eyelidMask,
    currentReport = report,
  ) {
    const c = canvasRef.current;
    const source = sourceImageDataRef.current;
    if (!c || !source) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = source.width;
    c.height = source.height;
    c.style.width = `${source.width}px`;
    c.style.height = "auto";
    ctx.putImageData(source, 0, 0);
    if (currentDetection) drawOverlay(ctx, currentDetection, currentEyelidMask, currentReport);
  }

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    currentDetection: Detection,
    currentEyelidMask: EyelidMask,
    currentReport: IrisReport | null,
  ) {
    const cx = currentDetection.cx;
    const cy = currentDetection.cy;

    ctx.strokeStyle = "#6BCB77";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, currentDetection.rIris, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#EAF7EF";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, currentDetection.rPupil, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(234,247,239,0.5)";
    ctx.lineWidth = 2;
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI / 2 - Math.PI / 12;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(a) * currentDetection.rPupil,
        cy + Math.sin(a) * currentDetection.rPupil,
      );
      ctx.lineTo(
        cx + Math.cos(a) * currentDetection.rIris,
        cy + Math.sin(a) * currentDetection.rIris,
      );
      ctx.stroke();
    }

    ctx.fillStyle = "#6BCB77";
    ctx.strokeStyle = "#EAF7EF";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx + currentDetection.rIris, cy, IRIS_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#EAF7EF";
    ctx.strokeStyle = "#1F4D3A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + currentDetection.rPupil, cy, PUPIL_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawEyelidMask(ctx, currentDetection, currentEyelidMask);
    drawFindingMarkers(ctx, currentReport);
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: ((event.clientX - rect.left) / rect.width) * c.width,
      y: ((event.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function updatePointerSide(event: PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    const currentDetection = detectionRef.current;
    if (!point || !currentDetection) {
      setPointerSide(null);
      return;
    }

    setPointerSide(point.x < currentDetection.cx ? "left" : "right");
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const currentDetection = detectionRef.current ?? detection;
    if (!imageReady || !currentDetection) return;
    updatePointerSide(event);
    const point = getCanvasPoint(event);
    if (!point) return;

    const currentEyelidMask = eyelidMaskRef.current;
    const irisHandleX = currentDetection.cx + currentDetection.rIris;
    const pupilHandleX = currentDetection.cx + currentDetection.rPupil;
    const handleY = currentDetection.cy;
    const upperEyelidHandle = eyelidHandlePoint(currentDetection, currentEyelidMask, "upper");
    const lowerEyelidHandle = eyelidHandlePoint(currentDetection, currentEyelidMask, "lower");
    const irisHandleDistance = Math.hypot(point.x - irisHandleX, point.y - handleY);
    const pupilHandleDistance = Math.hypot(point.x - pupilHandleX, point.y - handleY);
    const upperHandleDistance = Math.hypot(
      point.x - upperEyelidHandle.x,
      point.y - upperEyelidHandle.y,
    );
    const lowerHandleDistance = Math.hypot(
      point.x - lowerEyelidHandle.x,
      point.y - lowerEyelidHandle.y,
    );
    const centerDistance = Math.hypot(point.x - currentDetection.cx, point.y - currentDetection.cy);
    const nearRing =
      Math.abs(centerDistance - currentDetection.rIris) <=
      Math.max(18, currentDetection.rIris * 0.08);
    const eyelidHitSize = Math.max(
      EYELID_LINE_HIT_SIZE,
      currentDetection.rIris * EYELID_LINE_HIT_RADIUS_RATIO,
    );
    const eyelidLineHit = eyelidDragModeFromPoint(
      currentDetection,
      currentEyelidMask,
      point,
      eyelidHitSize,
    );
    let mode: DragMode = "move";

    if (upperHandleDistance <= EYELID_HANDLE_HIT_SIZE) {
      mode = "upperLid";
    } else if (lowerHandleDistance <= EYELID_HANDLE_HIT_SIZE) {
      mode = "lowerLid";
    } else if (eyelidLineHit) {
      mode = eyelidLineHit;
    } else if (pupilHandleDistance <= PUPIL_HANDLE_SIZE * HANDLE_HIT_MULTIPLIER) {
      mode = "resizePupil";
    } else if (irisHandleDistance <= IRIS_HANDLE_SIZE * HANDLE_HIT_MULTIPLIER || nearRing) {
      mode = "resize";
    }

    if (mode === "move" && centerDistance > currentDetection.rIris) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const eyelidReferenceY =
      mode === "upperLid" || mode === "lowerLid"
        ? eyelidCurveY(
            currentDetection,
            currentEyelidMask,
            mode === "upperLid" ? "upper" : "lower",
            point.x,
          )
        : null;
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      offsetX: point.x - currentDetection.cx,
      offsetY:
        eyelidReferenceY === null ? point.y - currentDetection.cy : point.y - eyelidReferenceY,
    };
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    updatePointerSide(event);
    const drag = dragRef.current;
    const currentDetection = detectionRef.current;
    const source = sourceImageDataRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !currentDetection || !source) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    event.preventDefault();
    if (drag.mode === "upperLid" || drag.mode === "lowerLid") {
      const lid = drag.mode === "upperLid" ? "upper" : "lower";
      const currentEyelidMask = eyelidMaskRef.current;
      const offset = eyelidOffsetFromPoint(currentDetection, lid, {
        x: point.x,
        y: point.y - drag.offsetY,
      });
      const next =
        drag.mode === "upperLid"
          ? {
              ...currentEyelidMask,
              topOffset: clamp(
                offset,
                EYELID_OFFSET_MIN,
                currentEyelidMask.bottomOffset - EYELID_MIN_GAP,
              ),
            }
          : {
              ...currentEyelidMask,
              bottomOffset: clamp(
                offset,
                currentEyelidMask.topOffset + EYELID_MIN_GAP,
                EYELID_OFFSET_MAX,
              ),
            };
      updateEyelidMask(next);
      setReport(null);
      redrawSourceWithOverlay(currentDetection, next);
      if (autoDetectionRef.current) setError(null);
      return;
    }

    if (drag.mode === "resize") {
      const maxRadius = Math.min(
        currentDetection.cx,
        currentDetection.cy,
        source.width - currentDetection.cx,
        source.height - currentDetection.cy,
      );
      const rIris = clamp(
        Math.hypot(point.x - currentDetection.cx, point.y - currentDetection.cy),
        20,
        Math.max(20, maxRadius),
      );
      updateDetectionByDrag({
        ...currentDetection,
        rIris,
        rPupil: clampPupilRadius(currentDetection.rPupil, rIris),
      });
      return;
    }

    if (drag.mode === "resizePupil") {
      updateDetectionByDrag({
        ...currentDetection,
        rPupil: clampPupilRadius(
          Math.hypot(point.x - currentDetection.cx, point.y - currentDetection.cy),
          currentDetection.rIris,
        ),
      });
      return;
    }

    const rIris = currentDetection.rIris;
    const cx = clamp(point.x - drag.offsetX, rIris, source.width - rIris);
    const cy = clamp(point.y - drag.offsetY, rIris, source.height - rIris);
    updateDetectionByDrag({
      ...currentDetection,
      cx,
      cy,
    });
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCanvasPointerLeave() {
    if (!dragRef.current) setPointerSide(null);
  }

  const pointerSideLabel = pointerSide ? eyeOrientationLabel(eye, pointerSide) : "Move over eye";
  const leftSideLabel = eyeOrientationLabel(eye, "left");
  const rightSideLabel = eyeOrientationLabel(eye, "right");

  return (
    <div className="grid lg:grid-cols-[65fr_35fr] gap-8">
      <div className="space-y-4">
        <div
          className={`relative rounded-2xl bg-deep shadow-soft mx-auto overflow-hidden ${
            imageReady ? "w-fit max-w-full" : "w-full min-h-[320px]"
          }`}
        >
          <canvas
            ref={canvasRef}
            className={`block max-w-full h-auto object-contain ${imageReady && detection ? "cursor-grab touch-none" : ""}`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
          />
          {(!imageReady || imageLoading || (analyzing && !detection)) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground gap-3 bg-deep/90">
              {openCvLoading || imageLoading || analyzing ? (
                <>
                  <Loader2 className="iris-loader-spin h-8 w-8" />
                  <p className="text-sm opacity-80">
                    {imageLoading || analyzing
                      ? "Locking iris..."
                      : "Loading OpenCV vision engine..."}
                  </p>
                </>
              ) : (
                <>
                  <ScanEye className="h-10 w-10" />
                  <p className="text-sm opacity-80">Choose an eye image to begin</p>
                </>
              )}
            </div>
          )}
          {imageReady && detection && (
            <div className="pointer-events-none absolute top-3 left-3 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium">
              Iris locked · r={Math.round(detection.rIris)}px
            </div>
          )}
          {imageReady && detection && (
            <div className=" hidden pointer-events-none absolute top-3 right-3 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground">
              Mouse: {pointerSideLabel}
            </div>
          )}
          {imageReady && detection && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
              <span className="rounded-full bg-background/80 px-3 py-1 backdrop-blur">
                ← {leftSideLabel}
              </span>
              <span className="rounded-full bg-background/80 px-3 py-1 text-right backdrop-blur">
                {rightSideLabel} →
              </span>
            </div>
          )}
          {imageReady && !detection && !analyzing && (
            <div className="pointer-events-none absolute top-3 left-3 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground">
              No iris locked
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={chooseImage}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!openCvReady || openCvLoading || imageLoading || analyzing}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium shadow-soft hover:brightness-110 transition disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" /> Choose an eye image
          </button>
          <button
            onClick={analyzeIris}
            disabled={!openCvReady || !detection || imageLoading || analyzing}
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-lg font-medium shadow-glow hover:brightness-110 transition disabled:opacity-40 disabled:shadow-none"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanEye className="h-4 w-4" />
            )}
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

        {imageReady && detection && sourceImageDataRef.current && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Fine-tune the iris overlay</div>
                <p className="text-xs text-muted-foreground">
                  Drag the circle to move it, the green handle to resize the iris, the white handle
                  to resize the pupil, and use the eyelid sliders at the bottom of the image to
                  exclude covered areas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetDetection}
                  className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              The reading ignores pixels above the upper eyelid curve and below the lower eyelid
              curve. Press <em>Read this iris</em> when the mask matches the visible iris.
            </div>
          </div>
        )}

        {displayedError && (
          <div className="flex gap-2 items-start text-sm bg-destructive/10 text-destructive border border-destructive/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {displayedError}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Tip: use a bright, evenly lit close-up eye photo and look slightly to the side to reduce
          glare. OpenCV scans only the image you choose.
        </p>
      </div>

      <aside className="space-y-4">
        <h2 className="font-display text-2xl">Reading</h2>
        {!report && (
          <p className="text-sm text-muted-foreground">
            No reading yet. Lock onto an iris, then press <em>Read this iris</em>. The analysis runs
            entirely in your browser — no image leaves your device.
          </p>
        )}
        {report && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-soft">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Iris color
              </div>
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
                      <span className="text-primary mt-0">•</span> {r}
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
                  <li key={f.hour} className="bg-card border border-border rounded-lg p-3 text-sm">
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
              These observations follow the traditional iridology framework of Bernard Jensen and
              Henry Lindlahr. They are <strong>not a medical diagnosis</strong>. Consult a licensed
              clinician for health concerns.
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const IRIS_ZONES = [
  { hour: 12, rightEye: "Cerebrum / forebrain", leftEye: "Cerebrum / forebrain" },
  { hour: 1, rightEye: "Forehead, sinus, face", leftEye: "Cerebellum, equilibrium" },
  { hour: 2, rightEye: "Throat, thyroid, ear", leftEye: "Speech, throat, ear" },
  { hour: 3, rightEye: "Bronchi, lungs (right)", leftEye: "Heart, chest (left lung)" },
  { hour: 4, rightEye: "Liver, gallbladder", leftEye: "Spleen, diaphragm" },
  { hour: 5, rightEye: "Stomach, pancreas (head)", leftEye: "Stomach, pancreas (tail)" },
  { hour: 6, rightEye: "Kidney, adrenal, bladder", leftEye: "Kidney, adrenal, bladder" },
  { hour: 7, rightEye: "Sciatic, lower colon", leftEye: "Sciatic, lower colon" },
  { hour: 8, rightEye: "Reproductive (right)", leftEye: "Reproductive (left)" },
  { hour: 9, rightEye: "Liver lobe, ribs", leftEye: "Heart base, ribs" },
  { hour: 10, rightEye: "Shoulder, arm", leftEye: "Shoulder, arm" },
  { hour: 11, rightEye: "Cerebellum, balance", leftEye: "Forehead, sinus, face" },
];

function classifyColor(r: number, g: number, b: number) {
  if (b > r && b > g && b - r > 15) return "Blue / lymphatic";
  if (r > b && r - b > 25 && g > b) return "Brown / hematogenic";
  if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15) return "Grey / mixed";
  if (g > r && g > b) return "Hazel-green / biliary";
  return "Mixed / intermediate";
}

function toneDescription(r: number, g: number, b: number) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 70) return "Deep, low-light reading - try brighter ambient lighting.";
  if (lum > 200) return "Very bright - possible glare washing out fiber detail.";
  return `Tone balance R${Math.round(r)} G${Math.round(g)} B${Math.round(b)}.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampPupilRadius(radius: number, irisRadius: number) {
  return clamp(radius, 5, Math.max(5, irisRadius - 8));
}

function waitForLoaderPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 80);
      });
    });
  });
}

function eyeOrientationLabel(eye: Eye, side: PointerSide) {
  const noseSide: PointerSide = eye === "right" ? "right" : "left";
  return side === noseSide ? "Nose / other eye side" : "Temple side";
}

function eyelidCurveY(
  detection: Detection,
  eyelidMask: EyelidMask,
  lid: "upper" | "lower",
  x: number,
) {
  const normalizedX = clamp((x - detection.cx) / detection.rIris, -1, 1);
  const edgeCurve = detection.rIris * 0.18 * normalizedX * normalizedX;

  if (lid === "upper") return detection.cy + detection.rIris * eyelidMask.topOffset + edgeCurve;
  return detection.cy + detection.rIris * eyelidMask.bottomOffset - edgeCurve;
}

function eyelidHandlePoint(
  detection: Detection,
  eyelidMask: EyelidMask,
  lid: "upper" | "lower",
): CanvasPoint {
  return {
    x: detection.cx,
    y: eyelidCurveY(detection, eyelidMask, lid, detection.cx),
  };
}

function eyelidDragModeFromPoint(
  detection: Detection,
  eyelidMask: EyelidMask,
  point: CanvasPoint,
  hitSize = EYELID_LINE_HIT_SIZE,
): Extract<DragMode, "upperLid" | "lowerLid"> | null {
  if (point.x < detection.cx - detection.rIris || point.x > detection.cx + detection.rIris) {
    return null;
  }

  const upperDistance = Math.abs(point.y - eyelidCurveY(detection, eyelidMask, "upper", point.x));
  const lowerDistance = Math.abs(point.y - eyelidCurveY(detection, eyelidMask, "lower", point.x));
  const closestDistance = Math.min(upperDistance, lowerDistance);

  if (closestDistance > hitSize) return null;
  return upperDistance <= lowerDistance ? "upperLid" : "lowerLid";
}

function eyelidOffsetFromPoint(detection: Detection, lid: "upper" | "lower", point: CanvasPoint) {
  const normalizedX = clamp((point.x - detection.cx) / detection.rIris, -1, 1);
  const edgeCurve = detection.rIris * 0.18 * normalizedX * normalizedX;

  if (lid === "upper") return (point.y - detection.cy - edgeCurve) / detection.rIris;
  return (point.y - detection.cy + edgeCurve) / detection.rIris;
}

function isVisibleThroughEyelids(
  detection: Detection,
  eyelidMask: EyelidMask,
  x: number,
  y: number,
) {
  return (
    y >= eyelidCurveY(detection, eyelidMask, "upper", x) &&
    y <= eyelidCurveY(detection, eyelidMask, "lower", x)
  );
}

function strongestSample<T extends CanvasPoint>(samples: T[], score: (sample: T) => number) {
  let best: T | undefined;
  let bestScore = -Infinity;

  for (const sample of samples) {
    const nextScore = score(sample);
    if (nextScore > bestScore) {
      best = sample;
      bestScore = nextScore;
    }
  }

  return best ? { x: best.x, y: best.y } : undefined;
}

function drawEyelidMask(
  ctx: CanvasRenderingContext2D,
  detection: Detection,
  eyelidMask: EyelidMask,
) {
  const left = detection.cx - detection.rIris;
  const right = detection.cx + detection.rIris;
  const steps = 56;

  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#60A5FA";
  ctx.setLineDash([10, 8]);

  for (const lid of ["upper", "lower"] as const) {
    ctx.beginPath();
    for (let index = 0; index <= steps; index++) {
      const x = left + ((right - left) * index) / steps;
      const y = eyelidCurveY(detection, eyelidMask, lid, x);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = "#60A5FA";
  ctx.strokeStyle = "#EAF7EF";
  ctx.lineWidth = 3;

  for (const lid of ["upper", "lower"] as const) {
    const handle = eyelidHandlePoint(detection, eyelidMask, lid);
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, EYELID_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawFindingMarkers(ctx: CanvasRenderingContext2D, report: IrisReport | null) {
  if (!report) return;
  const spots = report.findings.filter((finding) => finding.spot && finding.confidence > 0.2);

  ctx.save();
  ctx.font = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const finding of spots.slice(0, 8)) {
    const spot = finding.spot;
    if (!spot) continue;

    ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
    ctx.strokeStyle = "#EAF7EF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1F4D3A";
    ctx.fillText(String(finding.hour), spot.x, spot.y + 0.5);
  }

  ctx.restore();
}

function matFromImageData(cv: any, imageData: ImageData) {
  if (typeof cv.matFromImageData === "function") return cv.matFromImageData(imageData);
  return cv.matFromArray(imageData.height, imageData.width, cv.CV_8UC4, imageData.data);
}

function detectIrisInCv(cv: any, imageData: ImageData): Detection | null {
  let src: any;
  let gray: any;
  let circles: any;

  try {
    src = matFromImageData(cv, imageData);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.medianBlur(gray, gray, 5);

    circles = new cv.Mat();
    cv.HoughCircles(
      gray,
      circles,
      cv.HOUGH_GRADIENT,
      1,
      Math.max(32, gray.rows / 8),
      100,
      40,
      Math.floor(gray.rows * 0.08),
      Math.floor(gray.rows * 0.35),
    );

    let best: Detection | null = null;
    if (circles.cols > 0) {
      let bestScore = -Infinity;
      for (let i = 0; i < circles.cols; i++) {
        const cx = circles.data32F[i * 3];
        const cy = circles.data32F[i * 3 + 1];
        const r = circles.data32F[i * 3 + 2];
        const distFromCenter = Math.hypot(cx - imageData.width / 2, cy - imageData.height / 2);
        const score = r - distFromCenter * 0.3;

        if (score > bestScore) {
          bestScore = score;
          best = { cx, cy, rIris: r, rPupil: r * 0.35 };
        }
      }
    }

    return best;
  } finally {
    src?.delete();
    gray?.delete();
    circles?.delete();
  }
}

function buildIrisMask(
  cv: any,
  width: number,
  height: number,
  detection: Detection,
  eyelidMask: EyelidMask,
  options: { excludePupil?: boolean; outerRingOnly?: boolean } = {},
) {
  const maskData = new Uint8Array(width * height);
  const minX = Math.max(0, Math.floor(detection.cx - detection.rIris - 1));
  const maxX = Math.min(width - 1, Math.ceil(detection.cx + detection.rIris + 1));
  const minY = Math.max(0, Math.floor(detection.cy - detection.rIris - 1));
  const maxY = Math.min(height - 1, Math.ceil(detection.cy + detection.rIris + 1));
  const irisSq = detection.rIris * detection.rIris;
  const pupilSq = detection.rPupil * detection.rPupil;
  const outerInnerSq = detection.rIris * 0.85 * detection.rIris * 0.85;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - detection.cx;
      const dy = y - detection.cy;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > irisSq) continue;
      if (options.excludePupil !== false && distanceSq < pupilSq) continue;
      if (options.outerRingOnly && distanceSq < outerInnerSq) continue;
      if (!isVisibleThroughEyelids(detection, eyelidMask, x, y)) continue;
      maskData[y * width + x] = 255;
    }
  }

  return cv.matFromArray(height, width, cv.CV_8UC1, maskData);
}

function analyzeIrisInCv(
  cv: any,
  imageData: ImageData,
  detection: Detection,
  eyelidMask: EyelidMask,
): IrisReport {
  const { cx, cy, rIris, rPupil } = detection;
  let src: any;
  let gray: any;
  let mask: any;
  let outerMask: any;

  try {
    src = matFromImageData(cv, imageData);
    mask = buildIrisMask(cv, src.cols, src.rows, detection, eyelidMask);

    const mean = cv.mean(src, mask);
    const [r, g, b] = [mean[0], mean[1], mean[2]];
    const irisColor = classifyColor(r, g, b);
    const dominantTone = toneDescription(r, g, b);

    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const findings: Finding[] = [];
    const overallMean = cv.mean(gray, mask)[0];

    for (const zone of IRIS_ZONES) {
      const centerAngle = ((zone.hour - 1) / 12) * 360 - 90;
      const a0 = ((centerAngle - 15) * Math.PI) / 180;
      const a1 = ((centerAngle + 15) * Math.PI) / 180;
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      const samples: Array<CanvasPoint & { value: number }> = [];

      for (let radPct = 0.4; radPct < 0.95; radPct += 0.08) {
        for (let aStep = 0; aStep <= 4; aStep++) {
          const angle = a0 + ((a1 - a0) * aStep) / 4;
          const rr = rPupil + (rIris - rPupil) * radPct;
          const px = Math.round(cx + Math.cos(angle) * rr);
          const py = Math.round(cy + Math.sin(angle) * rr);
          if (px < 0 || py < 0 || px >= gray.cols || py >= gray.rows) continue;
          if (!isVisibleThroughEyelids(detection, eyelidMask, px, py)) continue;
          const val = gray.ucharPtr(py, px)[0];
          sum += val;
          sumSq += val * val;
          samples.push({ x: px, y: py, value: val });
          n++;
        }
      }

      if (n === 0) continue;
      const m = sum / n;
      const variance = sumSq / n - m * m;
      const darkness = (overallMean - m) / Math.max(overallMean, 1);
      let observation = "Uniform fibers - no remarkable features.";
      let confidence = 0.2;
      let spot: CanvasPoint | undefined;

      if (darkness > 0.18) {
        observation =
          "Darker patch detected - classically read as a 'lacuna' / weakened tissue sign.";
        confidence = Math.min(0.85, darkness * 2);
        spot = strongestSample(samples, (sample) => -sample.value);
      } else if (variance > 900) {
        observation = "High fiber irregularity - Lindlahr's 'nerve ring' or stress pattern.";
        confidence = Math.min(0.75, variance / 1800);
        spot = strongestSample(samples, (sample) => Math.abs(sample.value - m));
      } else if (darkness < -0.15) {
        observation = "Brighter zone - Jensen associates with acute / inflamed activity.";
        confidence = Math.min(0.7, -darkness * 2);
        spot = strongestSample(samples, (sample) => sample.value);
      }

      findings.push({
        hour: zone.hour,
        zoneRight: zone.rightEye,
        zoneLeft: zone.leftEye,
        observation,
        confidence,
        spot,
      });
    }

    const ringObservations: string[] = [];
    outerMask = buildIrisMask(cv, src.cols, src.rows, detection, eyelidMask, {
      excludePupil: false,
      outerRingOnly: true,
    });
    const outerMean = cv.mean(src, outerMask);

    if (outerMean[0] + outerMean[1] + outerMean[2] < (r + g + b) * 0.75) {
      ringObservations.push(
        "Darker outer ring - historically called a 'scurf rim' (skin elimination zone).",
      );
    }
    if (b > r * 1.05 && b > g * 1.05) {
      ringObservations.push("Bluish cast - Jensen's 'lymphatic constitution'.");
    } else if (r > b * 1.1) {
      ringObservations.push(
        "Warm reddish-brown cast - Jensen's 'hematogenic / mixed constitution'.",
      );
    }

    return {
      irisColor,
      dominantTone,
      ringObservations,
      findings: findings.sort((a, b) => b.confidence - a.confidence),
    };
  } finally {
    src?.delete();
    gray?.delete();
    mask?.delete();
    outerMask?.delete();
  }
}

function fileToImage(file: Blob) {
  const objectUrl = URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be loaded."));
    };
    image.src = objectUrl;
  });
}
