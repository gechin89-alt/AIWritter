"use client";

import { useEffect, useRef, useState } from "react";

const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = 400; // 3:4

/**
 * Drag-to-pan, slider-to-zoom cropper enforcing XHS's mandatory 3:4 cover
 * ratio — matches the crop step from the xhs-cover-tool prototype
 * (.claude/xhs-cover-tool), reimplemented in React/canvas instead of vanilla
 * JS. Outputs a fixed 1080x1440 JPEG File so the rest of the pipeline
 * (upload, AI styling, sharp rendering) always receives a properly-framed
 * photo instead of whatever crop the original camera/gallery photo happened
 * to have.
 */
export function PhotoCropper({
  file,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  instructionLabel,
}: {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  instructionLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseScaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      baseScaleRef.current = Math.max(PREVIEW_WIDTH / img.naturalWidth, PREVIEW_HEIGHT / img.naturalHeight);
      offsetRef.current = { x: 0, y: 0 };
      setZoom(1);
      setReady(true);
    };
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function clampOffset(nextZoom: number) {
    const img = imgRef.current;
    if (!img) return;
    const scale = baseScaleRef.current * nextZoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const maxOffX = Math.max(0, drawW / 2 - PREVIEW_WIDTH / 2);
    const maxOffY = Math.max(0, drawH / 2 - PREVIEW_HEIGHT / 2);
    offsetRef.current = {
      x: Math.min(maxOffX, Math.max(-maxOffX, offsetRef.current.x)),
      y: Math.min(maxOffY, Math.max(-maxOffY, offsetRef.current.y)),
    };
  }

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    const scale = baseScaleRef.current * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = PREVIEW_WIDTH / 2 + offsetRef.current.x;
    const cy = PREVIEW_HEIGHT / 2 + offsetRef.current.y;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }

  useEffect(() => {
    if (!ready) return;
    clampOffset(zoom);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zoom]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointRef.current.x;
      const dy = e.clientY - lastPointRef.current.y;
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
      clampOffset(zoom);
      draw();
    }
    function handleUp() {
      draggingRef.current = false;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = 1080;
    outputCanvas.height = 1440;
    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return;
    const factor = 1080 / PREVIEW_WIDTH;
    const scale = baseScaleRef.current * zoom * factor;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = 1080 / 2 + offsetRef.current.x * factor;
    const cy = 1440 / 2 + offsetRef.current.y * factor;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cropped = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        onConfirm(cropped);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{instructionLabel}</p>
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        onPointerDown={handlePointerDown}
        className="cursor-move touch-none rounded-lg border border-zinc-300 dark:border-zinc-700"
      />
      <input
        type="range"
        min={100}
        max={300}
        value={Math.round(zoom * 100)}
        onChange={(e) => setZoom(Number(e.target.value) / 100)}
        className="w-full max-w-[300px]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
