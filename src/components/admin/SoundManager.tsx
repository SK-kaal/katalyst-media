"use client";

import { Music2, MoreHorizontal } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageCropModal, useImagePicker } from "@/components/admin/ImageCropModal";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  attachCampaignSound,
  previewTikTokSound,
  refreshCampaignSound,
  removeCampaignSound,
  updateCampaignSoundDetails,
} from "@/lib/portal/actions";
import { rethrowNextNavigation, toUserError } from "@/lib/portal/errors";
import {
  campaignArtwork,
  campaignSoundArtist,
  campaignSoundTitle,
  formatFullNumber,
} from "@/lib/portal/metrics";
import type { Campaign } from "@/lib/supabase/database.types";
import type { TikTokSoundData } from "@/lib/tiktok/provider";
import { useRouter } from "next/navigation";

function SoundArtwork({
  url,
  className = "size-20",
}: {
  url: string | null;
  className?: string;
}) {
  return (
    <div
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-white/8 bg-graphite`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <Music2 className="size-6 text-white/25" aria-hidden="true" />
      )}
    </div>
  );
}

function SoundDialog({
  open,
  title,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("input, button, select, textarea")
        ?.focus();
    }, 10);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
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
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="admin-modal-root" role="presentation">
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-modal"
      >
        <h2
          id={titleId}
          className="font-display text-xl font-semibold tracking-[-0.03em]"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SoundManager({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit" | "change" | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [lookupUrl, setLookupUrl] = useState("");
  const [preview, setPreview] = useState<TikTokSoundData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingArtwork, setPendingArtwork] = useState<Blob | null>(null);
  const [removeManualArtwork, setRemoveManualArtwork] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState(campaignArtwork(campaign) ?? "");
  const picker = useImagePicker();
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasSound = Boolean(campaign.tiktok_sound_url && campaign.tiktok_sound_id);
  const title = campaignSoundTitle(campaign);
  const artist = campaignSoundArtist(campaign);
  const automaticDataIncomplete =
    hasSound &&
    (!campaign.sound_title ||
      !campaign.sound_artist ||
      !campaign.sound_artwork_url ||
      campaign.sound_usage_count == null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!artworkUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(artworkUrl);
  }, [artworkUrl]);

  const closeLookup = () => {
    if (pending || lookingUp) return;
    setMode(null);
    setLookupUrl("");
    setPreview(null);
    setError(null);
  };

  const lookup = () => {
    const url = lookupUrl.trim();
    if (!url) return;
    setLookingUp(true);
    setPreview(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewTikTokSound(url);
        if (!result.ok) throw new Error(result.error);
        setPreview(result.data);
      } catch (err) {
        rethrowNextNavigation(err);
        setError(toUserError(err, "TikTok sound unavailable."));
      } finally {
        setLookingUp(false);
      }
    });
  };

  const confirmSound = () => {
    if (!preview) return;
    startTransition(async () => {
      try {
        const result = await attachCampaignSound(campaign.id, preview.soundUrl);
        toast(
          result.sameSound
            ? "✓ Same sound recognised · metadata refreshed"
            : mode === "change"
              ? "✓ TikTok sound changed"
              : "✓ TikTok sound added",
        );
        setMode(null);
        setLookupUrl("");
        setPreview(null);
        router.refresh();
      } catch (err) {
        rethrowNextNavigation(err);
        setError(toUserError(err, "Could not save this TikTok sound."));
      }
    });
  };

  const saveDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (submitter?.name === "use_tiktok_metadata") {
      formData.set("use_tiktok_metadata", "1");
    }
    if (pendingArtwork) {
      formData.set("sound_artwork_file", pendingArtwork, "sound-artwork.jpg");
    }
    if (removeManualArtwork || (!artworkUrl && campaign.artwork_url)) {
      formData.set("remove_artwork", "1");
    }
    startTransition(async () => {
      try {
        const result = await updateCampaignSoundDetails(campaign.id, formData);
        setArtworkUrl(result.artworkUrl ?? "");
        setPendingArtwork(null);
        setMode(null);
        toast("✓ Sound details saved");
        router.refresh();
      } catch (err) {
        rethrowNextNavigation(err);
        setError(toUserError(err, "Could not save sound details."));
      }
    });
  };

  return (
    <>
      <div className="admin-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              TikTok Sound
            </h2>
            <p className="mt-1 text-xs text-muted-grey">
              Exact sound only · may include organic / non-Katalyst posts
            </p>
          </div>
          {hasSound ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="admin-icon-btn"
                aria-label="Manage TikTok sound"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="admin-menu" role="menu">
                  <button
                    type="button"
                    className="admin-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setArtworkUrl(campaignArtwork(campaign) ?? "");
                      setRemoveManualArtwork(false);
                      setError(null);
                      setMode("edit");
                    }}
                  >
                    Edit Sound
                  </button>
                  <button
                    type="button"
                    className="admin-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setError(null);
                      setMode("change");
                    }}
                  >
                    Change Sound
                  </button>
                  <button
                    type="button"
                    className="admin-menu__item text-[#ff8f8f]"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setRemoveOpen(true);
                    }}
                  >
                    Remove Sound
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasSound ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <SoundArtwork url={campaignArtwork(campaign)} className="size-24" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold tracking-[-0.03em]">
                {title || "Sound title unavailable"}
              </p>
              <p className="mt-1 truncate text-sm text-soft-grey">
                {artist || "Artist unavailable"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={campaign.tiktok_sound_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-acid-lime"
                >
                  View Sound on TikTok ↗
                </a>
                {automaticDataIncomplete ? (
                  <button
                    type="button"
                    className="text-xs text-soft-grey underline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          const result = await refreshCampaignSound(campaign.id);
                          toast(
                            result.usageRetrieved
                              ? "✓ Missing TikTok data refreshed"
                              : "Sound refreshed · some TikTok data remains unavailable",
                            result.usageRetrieved ? "ok" : "warn",
                          );
                          router.refresh();
                        } catch (err) {
                          rethrowNextNavigation(err);
                          toast(toUserError(err, "Sound retry failed"), "error");
                        }
                      })
                    }
                  >
                    {pending ? "Retrying…" : "Retry Sound"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="sm:text-right">
              {campaign.sound_usage_count != null ? (
                <>
                  <p className="admin-metric__value text-[1.8rem]">
                    {formatFullNumber(Number(campaign.sound_usage_count))}
                  </p>
                  <p className="admin-metric__label mt-1">TikTok Creations</p>
                </>
              ) : (
                <p className="max-w-[12rem] text-sm text-muted-grey">
                  Creation count not available yet
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 max-w-xl">
            <p className="font-display text-base font-semibold">
              No TikTok sound added.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-soft-grey">
              Add the exact TikTok sound used for this campaign to track sound
              information and creations.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn--primary mt-4"
              onClick={() => {
                setError(null);
                setMode("add");
              }}
            >
              Add TikTok Sound
            </button>
          </div>
        )}
      </div>

      <SoundDialog
        open={mode === "add" || mode === "change"}
        title={mode === "change" ? "Change TikTok Sound" : "Add TikTok Sound"}
        onCancel={closeLookup}
      >
        <p className="mt-2 text-sm leading-relaxed text-soft-grey">
          {mode === "change"
            ? "Your current sound remains unchanged until the new URL is validated and confirmed."
            : "Paste the exact TikTok music or sound URL. Available details are filled automatically."}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="admin-input flex-1"
            value={lookupUrl}
            onChange={(event) => {
              setLookupUrl(event.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="https://www.tiktok.com/music/…"
            aria-label="New TikTok sound URL"
          />
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={pending || lookingUp || !lookupUrl.trim()}
            onClick={lookup}
          >
            {lookingUp ? "Checking…" : "Check Sound"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-[#ff8f8f]" role="alert">
            {error}
          </p>
        ) : null}
        {preview ? (
          <div className="mt-4 flex gap-3 rounded-[10px] border border-acid-lime/25 bg-black/25 p-3">
            <SoundArtwork url={preview.artworkUrl} />
            <div className="min-w-0">
              <p className="font-semibold">
                {preview.title || "Sound title unavailable"}
              </p>
              <p className="mt-1 text-sm text-soft-grey">
                {preview.artist || "Artist unavailable"}
              </p>
              <p className="mt-2 text-xs text-muted-grey">
                {preview.usageCount != null
                  ? `${formatFullNumber(preview.usageCount)} TikTok Creations`
                  : "Creation count unavailable · can be retried later"}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={pending || lookingUp}
            onClick={closeLookup}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={pending || lookingUp || !preview}
            onClick={confirmSound}
          >
            {pending
              ? "Saving…"
              : mode === "change"
                ? "Confirm Change"
                : "Add Sound"}
          </button>
        </div>
      </SoundDialog>

      <SoundDialog
        open={mode === "edit"}
        title="Edit Sound"
        onCancel={() => {
          if (pending) return;
          setMode(null);
          setError(null);
          setPendingArtwork(null);
          setRemoveManualArtwork(false);
          picker.clear();
        }}
      >
        <form className="mt-4 space-y-4" onSubmit={saveDetails}>
          <div>
            <label className="admin-label" htmlFor="edit-sound-title">
              Sound Title
            </label>
            <input
              id="edit-sound-title"
              name="sound_title"
              className="admin-input"
              defaultValue={title ?? ""}
              maxLength={160}
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="edit-sound-artist">
              Artist Name
            </label>
            <input
              id="edit-sound-artist"
              name="sound_artist"
              className="admin-input"
              defaultValue={artist ?? ""}
              maxLength={120}
            />
          </div>
          <div>
            <p className="admin-label">Artwork</p>
            <div className="mt-2 flex items-center gap-4">
              <button
                type="button"
                className="admin-avatar-btn"
                disabled={pending}
                aria-label="Upload sound artwork"
                onClick={() => fileRef.current?.click()}
              >
                {artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artworkUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-grey">+ Upload</span>
                )}
              </button>
              <div className="space-y-2">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                >
                  {artworkUrl ? "Replace artwork" : "Upload artwork"}
                </button>
                <div className="flex flex-wrap gap-2">
                  {campaign.artwork_url && artworkUrl ? (
                    <button
                      type="button"
                      className="text-xs text-soft-grey underline"
                      disabled={pending}
                      onClick={() => setCropOpen(true)}
                    >
                      Reposition
                    </button>
                  ) : null}
                  {campaign.artwork_url && campaign.sound_artwork_url ? (
                    <button
                      type="button"
                      className="text-xs text-soft-grey underline"
                      disabled={pending}
                      onClick={() => {
                        setArtworkUrl(campaign.sound_artwork_url ?? "");
                        setPendingArtwork(null);
                        setRemoveManualArtwork(true);
                      }}
                    >
                      Use TikTok Artwork
                    </button>
                  ) : null}
                  {artworkUrl ? (
                    <button
                      type="button"
                      className="text-xs text-[#ff8f8f] underline"
                      disabled={pending}
                      onClick={() => {
                        setArtworkUrl(campaign.sound_artwork_url ?? "");
                        setPendingArtwork(null);
                        setRemoveManualArtwork(Boolean(campaign.artwork_url));
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-[0.68rem] text-muted-grey">
                  JPG, JPEG, PNG or WEBP · Max 5MB · Square crop
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                try {
                  if (!file) return;
                  picker.pick(file);
                  setRemoveManualArtwork(false);
                  setCropOpen(true);
                } catch (err) {
                  setError(toUserError(err, "Invalid image."));
                }
                event.target.value = "";
              }}
            />
          </div>
          {error ? (
            <p className="text-sm text-[#ff8f8f]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {campaign.sound_title_override || campaign.sound_artist_override ? (
              <button
                type="submit"
                name="use_tiktok_metadata"
                value="1"
                className="text-xs text-soft-grey underline"
                disabled={pending}
              >
                Use TikTok Details
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={pending}
                onClick={() => setMode(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save Sound"}
              </button>
            </div>
          </div>
        </form>
      </SoundDialog>

      <ImageCropModal
        key={picker.localUrl || artworkUrl || "empty"}
        open={cropOpen}
        title="Adjust sound artwork"
        sourceUrl={picker.localUrl || (cropOpen && artworkUrl ? artworkUrl : null)}
        onCancel={() => {
          setCropOpen(false);
          picker.clear();
        }}
        onSaved={(blob) => {
          setPendingArtwork(blob);
          setRemoveManualArtwork(false);
          setArtworkUrl(URL.createObjectURL(blob));
          setCropOpen(false);
          picker.clear();
          toast("Artwork ready · Save Sound to apply it");
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        title="Remove TikTok Sound?"
        body="This will remove the currently attached TikTok sound and its sound-specific analytics. Your campaign posts, campaign results, budget and client report link will remain unchanged."
        confirmLabel="Remove Sound"
        pendingLabel="Removing…"
        danger
        pending={pending}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            try {
              await removeCampaignSound(campaign.id);
              setRemoveOpen(false);
              toast("✓ TikTok sound removed");
              router.refresh();
            } catch (err) {
              rethrowNextNavigation(err);
              toast(toUserError(err, "Could not remove sound"), "error");
            }
          })
        }
      />
    </>
  );
}
