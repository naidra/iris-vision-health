// Loads OpenCV.js from CDN exactly once. Browser-only.
declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

let loaderPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.cv && window.cv.Mat) return Promise.resolve(window.cv);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("opencv-js-script") as HTMLScriptElement | null;
    const ready = () => {
      const tryResolve = () => {
        if (window.cv && window.cv.Mat) resolve(window.cv);
        else if (window.cv && typeof window.cv.then === "function") {
          window.cv.then((c: any) => resolve(c));
        } else {
          // wait for runtime initialization
          if (window.cv) {
            window.cv["onRuntimeInitialized"] = () => resolve(window.cv);
          } else {
            setTimeout(tryResolve, 50);
          }
        }
      };
      tryResolve();
    };

    if (existing) {
      existing.addEventListener("load", ready);
      existing.addEventListener("error", () => reject(new Error("Failed to load OpenCV")));
      return;
    }

    const script = document.createElement("script");
    script.id = "opencv-js-script";
    script.src = "https://docs.opencv.org/4.10.0/opencv.js";
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("Failed to load OpenCV.js"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
