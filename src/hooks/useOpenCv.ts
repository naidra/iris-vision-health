/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";

declare global {
  interface Window {
    cv: any;
  }
}

function localOpenCvUrl() {
  return new URL("opencv.js", window.location.origin + import.meta.env.BASE_URL).href;
}

function waitForCvReady(onReady: (cv: any) => void, onError: (message: string) => void) {
  let settled = false;

  const succeed = (cv: any) => {
    if (settled) return;
    if (!cv || !cv.Mat) return;
    settled = true;
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
    onReady(cv);
  };

  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
    onError(message);
  };

  const intervalId = window.setInterval(() => {
    succeed(window.cv);
  }, 100);

  const timeoutId = window.setTimeout(() => {
    fail("Timed out while loading the local OpenCV engine.");
  }, 15000);

  if (window.cv && typeof window.cv.then === "function") {
    try {
      window.cv.then((cv: any) => {
        succeed(cv ?? window.cv);
      });
    } catch {
      fail("Failed to initialize the local OpenCV engine.");
    }
  }

  succeed(window.cv);
}

export function useOpenCv() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let progressIntervalId: number | null = null;

    const startProgress = () => {
      if (!isMounted) return;
      setProgress((current) => Math.max(current, 8));
      progressIntervalId = window.setInterval(() => {
        if (!isMounted) return;
        setProgress((current) => {
          if (current >= 92) return current;
          const increment = current < 55 ? 7 : current < 80 ? 4 : 2;
          return Math.min(92, current + increment);
        });
      }, 320);
    };

    const stopProgress = (nextProgress: number) => {
      if (!isMounted) return;
      if (progressIntervalId !== null) {
        window.clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
      setProgress(nextProgress);
    };

    if (window.cv && window.cv.Mat) {
      setReady(true);
      setLoading(false);
      setProgress(100);
      return;
    }

    startProgress();

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-opencv-local="true"]',
    );
    const scriptSrc = localOpenCvUrl();

    const finish = (cv: any) => {
      if (!isMounted) return;
      if (cv && cv.Mat) {
        setReady(true);
        setLoading(false);
        setError(null);
        stopProgress(100);
        return;
      }

      setReady(false);
      setLoading(false);
      setError("OpenCV loaded but never became ready.");
      stopProgress(0);
    };

    const fail = (message: string) => {
      if (!isMounted) return;
      setReady(false);
      setLoading(false);
      setError(message);
      stopProgress(0);
    };

    if (existingScript?.src === scriptSrc) {
      waitForCvReady(finish, fail);
      return () => {
        isMounted = false;
        if (progressIntervalId !== null) window.clearInterval(progressIntervalId);
      };
    }

    existingScript?.remove();

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.dataset.opencvLocal = "true";

    script.onload = () => {
      setProgress((current) => Math.max(current, 96));
      waitForCvReady(finish, fail);
    };

    script.onerror = () => {
      fail("Failed to load the local OpenCV engine.");
    };

    document.head.appendChild(script);

    return () => {
      isMounted = false;
      if (progressIntervalId !== null) window.clearInterval(progressIntervalId);
    };
  }, []);

  return { ready, loading, error, progress };
}
