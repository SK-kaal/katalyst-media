"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  getCroppedImageBlob,
  validatePortalImage,
} from "@/lib/portal/storage";
import { uploadPortalAssetAction } from "@/lib/portal/actions";

export function ImageCropModal({
  open,
  title = "Adjust profile photo",
  sourceUrl,
  storagePath,
  onCancel,
  onSaved,
}: {
  open: boolean;
  title?: string;
  sourceUrl: string | null;
  storagePath: string;
  onCancel: () => void;
  onSaved: (publicUrl: string) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_cropped: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const save = async () => {
    if (!sourceUrl || !area) return;
    setPending(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(sourceUrl, area, 720);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const url = await uploadPortalAssetAction(storagePath, formData);
      onSaved(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  if (!open || !sourceUrl) return null;

  return (
    <div className="admin-modal-root" role="presentation">
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        className="admin-modal admin-modal--crop"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
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
            disabled={pending}
          >
            {pending ? "Saving…" : "Save Photo"}
          </button>
        </div>
      </div>
    </div>
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
