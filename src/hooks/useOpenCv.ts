/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    cv: any;
  }
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
  const loadAttempted = useRef(false);

  useEffect(() => {
    if (loadAttempted.current) return;
    loadAttempted.current = true;

    if (window.cv && window.cv.Mat) {
      setReady(true);
      setLoading(false);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-opencv-local="true"]',
    );

    const finish = (cv: any) => {
      if (cv && cv.Mat) {
        setReady(true);
        setLoading(false);
        setError(null);
        return;
      }

      setReady(false);
      setLoading(false);
      setError("OpenCV loaded but never became ready.");
    };

    const fail = (message: string) => {
      setReady(false);
      setLoading(false);
      setError(message);
    };

    if (existingScript) {
      waitForCvReady(finish, fail);
      return;
    }

    const script = document.createElement("script");
    script.src = new URL("opencv.js", location.href.replace('/reader', '')).href;
    script.async = true;
    script.dataset.opencvLocal = "true";

    script.onload = () => {
      waitForCvReady(finish, fail);
    };

    script.onerror = () => {
      fail("Failed to load the local OpenCV engine.");
    };

    document.head.appendChild(script);
  }, []);

  return { ready, loading, error };
}
