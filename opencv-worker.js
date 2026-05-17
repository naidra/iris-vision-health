let cvReadyPromise = null;

function postWorkerError(error) {
  self.postMessage({
    type: "error",
    message: error instanceof Error ? error.message : String(error || "OpenCV worker failed."),
  });
}

self.onerror = (message) => {
  postWorkerError(message);
};

self.onunhandledrejection = (event) => {
  postWorkerError(event.reason);
};

function loadOpenCv() {
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    try {
      importScripts("opencv.js");
    } catch (error) {
      reject(
        new Error(
          error instanceof Error
            ? `Failed to load local OpenCV: ${error.message}`
            : "Failed to load local OpenCV.",
        ),
      );
      return;
    }

    const timeout = self.setTimeout(() => {
      reject(new Error("Timed out while waiting for OpenCV to initialize."));
    }, 30000);

    Promise.resolve(self.cv)
      .then((cv) => {
        self.clearTimeout(timeout);
        if (cv && cv.Mat) {
          self.cv = cv;
          resolve(cv);
          return;
        }

        reject(new Error("OpenCV loaded but never became ready."));
      })
      .catch((error) => {
        self.clearTimeout(timeout);
        reject(
          new Error(
            error instanceof Error
              ? `Failed to initialize OpenCV: ${error.message}`
              : "Failed to initialize OpenCV.",
          ),
        );
      });
  });

  return cvReadyPromise;
}

function createMatFromImageData(imageData) {
  if (typeof self.cv.matFromImageData === "function") {
    return self.cv.matFromImageData(imageData);
  }
  return self.cv.matFromArray(imageData.height, imageData.width, self.cv.CV_8UC4, imageData.data);
}

function detectIrisInCv(imageData) {
  let src;
  let gray;
  let circles;

  try {
    src = createMatFromImageData(imageData);
    gray = new self.cv.Mat();
    self.cv.cvtColor(src, gray, self.cv.COLOR_RGBA2GRAY);
    self.cv.medianBlur(gray, gray, 5);

    circles = new self.cv.Mat();
    self.cv.HoughCircles(
      gray,
      circles,
      self.cv.HOUGH_GRADIENT,
      1,
      Math.max(32, gray.rows / 8),
      100,
      40,
      Math.floor(gray.rows * 0.08),
      Math.floor(gray.rows * 0.35),
    );

    let best = null;
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
          best = {
            cx,
            cy,
            rIris: r,
            rPupil: r * 0.35,
          };
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

function analyzeIrisInCv(imageData, detection) {
  const { cx, cy, rIris, rPupil } = detection;
  let src;
  let gray;
  let mask;
  let outerMask;

  try {
    src = createMatFromImageData(imageData);
    mask = new self.cv.Mat.zeros(src.rows, src.cols, self.cv.CV_8UC1);
    self.cv.circle(mask, new self.cv.Point(cx, cy), Math.floor(rIris), new self.cv.Scalar(255), -1);
    self.cv.circle(mask, new self.cv.Point(cx, cy), Math.floor(rPupil), new self.cv.Scalar(0), -1);

    const mean = self.cv.mean(src, mask);
    const [r, g, b] = [mean[0], mean[1], mean[2]];
    const irisColor = classifyColor(r, g, b);
    const dominantTone = toneDescription(r, g, b);

    gray = new self.cv.Mat();
    self.cv.cvtColor(src, gray, self.cv.COLOR_RGBA2GRAY);

    const findings = [];
    const overallMean = self.cv.mean(gray, mask)[0];

    for (const zone of IRIS_ZONES) {
      const centerAngle = ((zone.hour - 1) / 12) * 360 - 90;
      const a0 = ((centerAngle - 15) * Math.PI) / 180;
      const a1 = ((centerAngle + 15) * Math.PI) / 180;
      let sum = 0;
      let sumSq = 0;
      let n = 0;

      for (let radPct = 0.4; radPct < 0.95; radPct += 0.08) {
        for (let aStep = 0; aStep <= 4; aStep++) {
          const angle = a0 + ((a1 - a0) * aStep) / 4;
          const rr = rPupil + (rIris - rPupil) * radPct;
          const px = Math.round(cx + Math.cos(angle) * rr);
          const py = Math.round(cy + Math.sin(angle) * rr);
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
      let observation = "Uniform fibers - no remarkable features.";
      let confidence = 0.2;

      if (darkness > 0.18) {
        observation =
          "Darker patch detected - classically read as a 'lacuna' / weakened tissue sign.";
        confidence = Math.min(0.85, darkness * 2);
      } else if (variance > 900) {
        observation = "High fiber irregularity - Lindlahr's 'nerve ring' or stress pattern.";
        confidence = Math.min(0.75, variance / 1800);
      } else if (darkness < -0.15) {
        observation = "Brighter zone - Jensen associates with acute / inflamed activity.";
        confidence = Math.min(0.7, -darkness * 2);
      }

      findings.push({
        hour: zone.hour,
        zoneRight: zone.rightEye,
        zoneLeft: zone.leftEye,
        observation,
        confidence,
      });
    }

    const ringObservations = [];
    outerMask = new self.cv.Mat.zeros(src.rows, src.cols, self.cv.CV_8UC1);
    self.cv.circle(
      outerMask,
      new self.cv.Point(cx, cy),
      Math.floor(rIris),
      new self.cv.Scalar(255),
      -1,
    );
    self.cv.circle(
      outerMask,
      new self.cv.Point(cx, cy),
      Math.floor(rIris * 0.85),
      new self.cv.Scalar(0),
      -1,
    );
    const outerMean = self.cv.mean(src, outerMask);

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

const IRIS_ZONES = [
  { hour: 1, rightEye: "Brain", leftEye: "Brain" },
  { hour: 2, rightEye: "Head", leftEye: "Head" },
  { hour: 3, rightEye: "Sinuses", leftEye: "Sinuses" },
  { hour: 4, rightEye: "Lungs", leftEye: "Lungs" },
  { hour: 5, rightEye: "Lymph", leftEye: "Lymph" },
  { hour: 6, rightEye: "Heart", leftEye: "Heart" },
  { hour: 7, rightEye: "Liver", leftEye: "Pancreas" },
  { hour: 8, rightEye: "Kidneys", leftEye: "Kidneys" },
  { hour: 9, rightEye: "Bladder", leftEye: "Bladder" },
  { hour: 10, rightEye: "Colon", leftEye: "Colon" },
  { hour: 11, rightEye: "Stomach", leftEye: "Stomach" },
  { hour: 12, rightEye: "Adrenals", leftEye: "Adrenals" },
];

function classifyColor(r, g, b) {
  if (r > g && r > b) return "Warm brown";
  if (g > r && g > b) return "Green";
  if (b > r && b > g) return "Blue";
  return "Hazel";
}

function toneDescription(r, g, b) {
  const average = (r + g + b) / 3;
  if (average > 170) return "Bright and vivid tones.";
  if (average > 100) return "Moderate iris tone.";
  return "Darker iris tone.";
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || !message.type) return;

  if (message.type === "init") {
    loadOpenCv()
      .then(() => {
        self.postMessage({ type: "ready" });
      })
      .catch((error) => {
        self.postMessage({
          type: "init-error",
          message: error instanceof Error ? error.message : "Failed to initialize OpenCV.",
        });
      });
    return;
  }

  if (!cvReadyPromise) {
    self.postMessage({
      type: "task-error",
      id: message.id,
      message: "OpenCV worker is not ready yet.",
    });
    return;
  }

  if (message.type === "detect") {
    const { width, height, buffer } = message.payload;
    const data = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(data, width, height);
    try {
      await loadOpenCv();
      const detection = detectIrisInCv(imageData);
      self.postMessage({ type: "detect-result", id: message.id, payload: detection });
    } catch (error) {
      self.postMessage({ type: "task-error", id: message.id, message: error.message });
    }
    return;
  }

  if (message.type === "analyze") {
    const { width, height, buffer, detection } = message.payload;
    const data = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(data, width, height);
    try {
      await loadOpenCv();
      const report = analyzeIrisInCv(imageData, detection);
      self.postMessage({ type: "analyze-result", id: message.id, payload: report });
    } catch (error) {
      self.postMessage({ type: "task-error", id: message.id, message: error.message });
    }
    return;
  }
};
