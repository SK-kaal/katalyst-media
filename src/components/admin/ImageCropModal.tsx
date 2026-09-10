"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import {
  getCroppedImageBlob,
  validatePortalImage,
} from "@/lib/portal/storage";

export function ImageCropModal({
  open,
  title = "Adjust profile photo",
  sourceUrl,
  onCancel,
  onSaved,
}: {
  open: boolean;
  title?: string;
  sourceUrl: string | null;
  onCancel: () => void;
  onSaved: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const onCropComplete = useCallback((_cropped: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 20);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open || pending) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onCancel, open, pending]);

  const save = async () => {
    if (!sourceUrl || !area) return;
    setPending(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(sourceUrl, area, 720);
      onSaved(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  if (!open || !sourceUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="admin-modal-root"
      role="presentation"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="admin-modal admin-modal--crop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2
          id={titleId}
          className="font-display text-xl font-semibold tracking-[-0.03em]"
        >
          {title}
        </h2>
        <div className="admin-cropper mt-4">
          <Cropper
            image={sourceUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm text-soft-grey">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="admin-range flex-1"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-[#ff8f8f]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={save}
            disabled={pending || !area}
          >
            {pending ? "Applying…" : "Use Photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useImagePicker() {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const pick = (file: File) => {
    validatePortalImage(file);
    if (localUrl) URL.revokeObjectURL(localUrl);
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    setFileName(file.name);
  };

  const clear = () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setFileName(null);
  };

  return { localUrl, fileName, pick, clear };
}
