"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createCampaignFromSound,
  previewTikTokSound,
} from "@/lib/portal/actions";
import { toUserError } from "@/lib/portal/errors";
import { formatFullNumber } from "@/lib/portal/metrics";
import type { Client } from "@/lib/supabase/database.types";
import type { TikTokSoundData } from "@/lib/tiktok/provider";
import { useAdminToast } from "@/components/admin/AdminToast";

export function NewCampaignForm({
  clients,
  defaultClientId,
}: {
  clients: Pick<Client, "id" | "name" | "handle">[];
  defaultClientId?: string;
}) {
  const { toast } = useAdminToast();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [soundUrl, setSoundUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [targetPosts, setTargetPosts] = useState("");
  const [preview, setPreview] = useState<TikTokSoundData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);
  const clientLocked = Boolean(defaultClientId);
  const selectedClient = clients.find((c) => c.id === defaultClientId);

  const fetchSound = (url = soundUrl) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setPreview(null);
    setFetching(true);
    startTransition(async () => {
      try {
        const result = await previewTikTokSound(trimmed);
        if (!result.ok) {
          const msg = toUserError(result.error, "TikTok sound unavailable.");
          setError(msg);
          toast(msg, "error");
          return;
        }
        setPreview(result.data);
        toast("✓ Sound found");
      } catch (err) {
        const msg = toUserError(err, "TikTok sound unavailable.");
        setError(msg);
        toast(msg, "error");
      } finally {
        setFetching(false);
      }
    });
  };

  return (
    <form
      className="admin-panel mt-6 space-y-5 p-5 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const nextErrors: Record<string, string> = {};
        if (!String(formData.get("client_id") || "").trim()) {
          nextErrors.client_id = "Select a client.";
        }
        if (!soundUrl.trim()) {
          nextErrors.tiktok_sound_url = "TikTok sound URL is required.";
        }
        const budgetRaw = String(formData.get("budget") || "").trim();
        const budgetValue = Number(budgetRaw);
        if (!budgetRaw || !Number.isFinite(budgetValue) || budgetValue < 0) {
          nextErrors.budget = "Enter a valid budget.";
        }
        const targetRaw = String(formData.get("target_posts") || "").trim();
        const targetValue = Number(targetRaw);
        if (!targetRaw || !Number.isInteger(targetValue) || targetValue < 1) {
          nextErrors.target_posts = "Enter a whole number of target posts.";
        }
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          const first = Object.keys(nextErrors)[0];
          form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
          return;
        }

        setCreating(true);
        setError(null);
        startTransition(async () => {
          try {
            await createCampaignFromSound(formData);
            toast("✓ Campaign created");
          } catch (err) {
            if (
              err &&
              typeof err === "object" &&
              "digest" in err &&
              String((err as { digest?: string }).digest).includes("NEXT_REDIRECT")
            ) {
              throw err;
            }
            const msg = toUserError(
              err,
              "Something went wrong while creating the campaign.",
            );
            setError(msg);
            toast(msg, "error");
            setCreating(false);
          }
        });
      }}
    >
      <div>
        <label className="admin-label" htmlFor="client_id">
          Client / Artist *
        </label>
        {clientLocked && selectedClient ? (
          <>
            <input type="hidden" name="client_id" value={selectedClient.id} />
            <p className="rounded-[8px] border border-white/10 bg-black/25 px-3 py-2 text-sm font-semibold">
              {selectedClient.name}
              {selectedClient.handle ? (
                <span className="ml-2 font-normal text-muted-grey">
                  {selectedClient.handle}
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <select
            id="client_id"
            name="client_id"
            className="admin-select"
            defaultValue={defaultClientId || ""}
            required
          >
            <option value="" disabled>
              Select a client…
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.handle ? ` (${client.handle})` : ""}
              </option>
            ))}
          </select>
        )}
        {fieldErrors.client_id ? (
          <p className="admin-field-error">{fieldErrors.client_id}</p>
        ) : null}
        {!clientLocked ? (
          <p className="mt-2 text-xs text-muted-grey">
            Need a new artist?{" "}
            <Link
              href="/admin/clients?new=1#add-client"
              className="text-acid-lime"
            >
              Create client first
            </Link>
          </p>
        ) : null}
      </div>

      <div>
        <label className="admin-label" htmlFor="tiktok_sound_url">
          TikTok Sound URL *
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="tiktok_sound_url"
            name="tiktok_sound_url"
            className="admin-input flex-1"
            required
            placeholder="https://www.tiktok.com/music/…"
            value={soundUrl}
            onChange={(e) => {
              setSoundUrl(e.target.value);
              setPreview(null);
              setError(null);
            }}
          />
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={pending || fetching || creating}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text.trim()) {
                  setSoundUrl(text.trim());
                  setPreview(null);
                  fetchSound(text.trim());
                }
              } catch {
                toast(
                  "Clipboard unavailable — paste into the URL field.",
                  "error",
                );
              }
            }}
          >
            Paste from Clipboard
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={pending || fetching || creating || !soundUrl.trim()}
            onClick={() => fetchSound()}
          >
            {fetching ? "Checking…" : "Check Sound"}
          </button>
        </div>
        {fieldErrors.tiktok_sound_url ? (
          <p className="admin-field-error">{fieldErrors.tiktok_sound_url}</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[#ff8f8f]" role="alert">
          {error}
        </p>
      ) : null}

      {fetching ? (
        <p className="flex items-center gap-2 text-sm text-soft-grey">
          <span className="admin-fetch-dot" aria-hidden="true" />
          Fetching TikTok sound…
        </p>
      ) : null}

      {preview ? (
        <div className="rounded-[10px] border border-acid-lime/25 bg-black/25 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-acid-lime">
            ✓ Sound found
          </p>
          <div className="flex gap-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-[8px] bg-graphite">
              {preview.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.artworkUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-[-0.03em]">
                {preview.title}
              </p>
              <p className="mt-1 text-sm text-soft-grey">
                {preview.artist ||
                  selectedClient?.name ||
                  "Unknown artist"}
              </p>
              {preview.usageCount != null ? (
                <p className="mt-2 text-sm text-off-white">
                  {formatFullNumber(preview.usageCount)} TikTok Creations
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-grey">
                  TikTok Creations unavailable from TikTok for this sound
                </p>
              )}
              <a
                href={preview.soundUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-sm text-acid-lime"
              >
                View Sound on TikTok ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <label className="admin-label" htmlFor="budget">
          Campaign Budget (GBP) *
        </label>
        <input
          id="budget"
          name="budget"
          type="number"
          min="0"
          step="0.01"
          className="admin-input"
          required
          placeholder="2500"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        {fieldErrors.budget ? (
          <p className="admin-field-error">{fieldErrors.budget}</p>
        ) : null}
      </div>

      <div>
        <label className="admin-label" htmlFor="target_posts">
          Target Posts *
        </label>
        <input
          id="target_posts"
          name="target_posts"
          type="number"
          min="1"
          step="1"
          className="admin-input"
          required
          placeholder="30"
          value={targetPosts}
          onChange={(e) => setTargetPosts(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-grey">
          Number of campaign posts Katalyst intends to deliver. Separate from
          TikTok Creations.
        </p>
        {fieldErrors.target_posts ? (
          <p className="admin-field-error">{fieldErrors.target_posts}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Link
          href={defaultClientId ? `/admin/clients/${defaultClientId}` : "/admin"}
          className="admin-btn admin-btn--ghost"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={pending || creating || fetching}
        >
          {creating ? "Creating Campaign…" : "Create Campaign"}
        </button>
      </div>
    </form>
  );
}
