"use client";

import { useRef, useState, useTransition } from "react";
import { ImageCropModal, useImagePicker } from "@/components/admin/ImageCropModal";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  clientAvatarPath,
} from "@/lib/portal/storage";
import { removePortalAssetAction } from "@/lib/portal/actions";
import { toUserError } from "@/lib/portal/errors";
import type { Client, ClientType } from "@/lib/supabase/database.types";

export function ClientForm({
  mode,
  client,
  onSubmit,
}: {
  mode: "create" | "edit";
  client?: Client;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const { toast } = useAdminToast();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const picker = useImagePicker();
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(client?.profile_image_url ?? "");
  const [tempId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const storageId = client?.id ?? tempId;

  return (
    <>
      <form
        className="admin-panel space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "create" && !avatarUrl) {
            setError("Profile picture is required.");
            return;
          }
          const form = event.currentTarget;
          const formData = new FormData(form);
          formData.set("profile_image_url", avatarUrl);
          if (mode === "create") {
            formData.set("temp_client_id", tempId);
          }
          setError(null);
          startTransition(async () => {
            try {
              await onSubmit(formData);
              toast(mode === "create" ? "✓ Client created" : "✓ Changes saved");
            } catch (err) {
              // Server action redirects throw — let Next handle them.
              if (
                err &&
                typeof err === "object" &&
                "digest" in err &&
                String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")
              ) {
                throw err;
              }
              setError(
                toUserError(err, "Something went wrong while saving."),
              );
            }
          });
        }}
      >
        <div>
          <p className="admin-label">Profile picture *</p>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              className="admin-avatar-btn"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload profile picture"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-xs text-muted-grey">+ Upload</span>
              )}
            </button>
            <div className="space-y-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => fileRef.current?.click()}
              >
                {avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {avatarUrl ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-soft-grey underline"
                    onClick={() => setCropOpen(true)}
                  >
                    Reposition
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[#ff8f8f] underline"
                    onClick={async () => {
                      await removePortalAssetAction(avatarUrl);
                      setAvatarUrl("");
                      toast("Profile image removed");
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <p className="text-[0.68rem] text-muted-grey">
                JPG, PNG or WEBP · Max 5MB · Square crop
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              try {
                if (!file) return;
                picker.pick(file);
                setCropOpen(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid image.");
              }
              e.target.value = "";
            }}
          />
          <input type="hidden" name="profile_image_url" value={avatarUrl} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="admin-label" htmlFor="client-name">
              Client / Artist name *
            </label>
            <input
              id="client-name"
              name="name"
              className="admin-input"
              required
              defaultValue={client?.name ?? ""}
              placeholder="Mellina Tey"
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="client-type">
              Client type
            </label>
            <select
              id="client-type"
              name="client_type"
              className="admin-select"
              defaultValue={(client?.client_type as ClientType) ?? "artist"}
            >
              <option value="artist">Artist</option>
              <option value="manager">Manager</option>
              <option value="label">Label</option>
            </select>
          </div>
          <div>
            <label className="admin-label" htmlFor="client-handle">
              TikTok handle
            </label>
            <input
              id="client-handle"
              name="handle"
              className="admin-input"
              defaultValue={client?.handle ?? ""}
              placeholder="@mellinatey"
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="client-tiktok-url">
              TikTok profile URL
            </label>
            <input
              id="client-tiktok-url"
              name="tiktok_profile_url"
              className="admin-input"
              defaultValue={client?.tiktok_profile_url ?? ""}
              placeholder="https://www.tiktok.com/@mellinatey"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="admin-label" htmlFor="client-email">
              Email (optional)
            </label>
            <input
              id="client-email"
              name="email"
              type="email"
              className="admin-input"
              defaultValue={client?.email ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="admin-label" htmlFor="client-notes">
              Internal notes (Katalyst only)
            </label>
            <textarea
              id="client-notes"
              name="internal_notes"
              className="admin-input min-h-[5rem]"
              defaultValue={client?.internal_notes ?? ""}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-[#ff8f8f]" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending
            ? mode === "create"
              ? "Creating Client…"
              : "Saving…"
            : mode === "create"
              ? "Create Client"
              : "Save Changes"}
        </button>
      </form>

      <ImageCropModal
        open={cropOpen}
        sourceUrl={picker.localUrl || (cropOpen && avatarUrl ? avatarUrl : null)}
        storagePath={clientAvatarPath(storageId)}
        onCancel={() => {
          setCropOpen(false);
          picker.clear();
        }}
        onSaved={(url) => {
          setAvatarUrl(url);
          setCropOpen(false);
          picker.clear();
          toast("Profile image updated");
        }}
      />
    </>
  );
}
