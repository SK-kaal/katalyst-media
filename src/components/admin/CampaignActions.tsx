"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  endCampaign,
  permanentlyDeleteCampaign,
  refreshCampaignData,
  reopenCampaign,
  restoreCampaign,
  trashCampaign,
} from "@/lib/portal/actions";
import { formatCompactNumber } from "@/lib/portal/metrics";
import { rethrowNextNavigation, toUserError } from "@/lib/portal/errors";
import { company } from "@/content/company";
import type { Campaign, CampaignStatus } from "@/lib/supabase/database.types";

export function CampaignActionsMenu({
  campaign,
  clientId,
  trashed = false,
  context = "card",
  onMove,
}: {
  campaign: Pick<
    Campaign,
    "id" | "status" | "share_token" | "trashed_at"
  >;
  clientId?: string;
  trashed?: boolean;
  context?: "card" | "editor";
  onMove?: () => void;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<
    "end" | "reopen" | "trash" | "deleteForever" | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = campaign.status as CampaignStatus;
  const inTrash = trashed || Boolean(campaign.trashed_at);
  const reportUrl = campaign.share_token
    ? `${company.url}/report/${campaign.share_token}`
    : null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: {
    label: string;
    onClick?: () => void;
    href?: string;
    hide?: boolean;
  }[] = [
    {
      label: "Open Campaign",
      href: `/admin/campaigns/${campaign.id}`,
      hide: inTrash || context === "editor",
    },
    {
      label: "Add Posts",
      href: `/admin/campaigns/${campaign.id}?tab=content`,
      hide: inTrash || status === "ended" || context === "editor",
    },
    {
      label: status === "ended" ? "Preview Admin Report" : "Preview Report",
      href: `/admin/campaigns/${campaign.id}/preview`,
      hide: inTrash || context === "editor",
    },
    {
      label: copied ? "Copied ✓" : "Copy Client Link",
      hide: !reportUrl || inTrash || context === "editor",
      onClick: async () => {
        if (!reportUrl) return;
        try {
          await navigator.clipboard.writeText(reportUrl);
          setCopied(true);
          toast(
            status === "ended"
              ? "Copied ✓ · Client access currently disabled"
              : "Copied ✓",
          );
          window.setTimeout(() => setCopied(false), 1600);
          setOpen(false);
        } catch {
          toast("Could not copy the client link.", "error");
        }
      },
    },
    {
      label: "Refresh Data",
      hide: inTrash || status === "ended" || context === "editor",
      onClick: () => {
        startTransition(async () => {
          try {
            const result = await refreshCampaignData(campaign.id);
            const delta = result.posts.after.views - result.posts.before.views;
            toast(
              result.posts.failed || !result.sound.ok
                ? `Refresh complete · ${result.posts.updated} updated · ${result.posts.failed} failed`
                : `Refresh complete · ${result.posts.updated} updated · Views ${formatCompactNumber(result.posts.before.views)} → ${formatCompactNumber(result.posts.after.views)}${delta ? ` (${delta > 0 ? "+" : ""}${formatCompactNumber(Math.abs(delta))})` : ""}`,
            );
            setOpen(false);
            router.refresh();
          } catch (error) {
            rethrowNextNavigation(error);
            toast(toUserError(error, "Refresh failed"), "error");
          }
        });
      },
    },
    {
      label: "End Campaign",
      hide: inTrash || status !== "active" || context === "editor",
      onClick: () => {
        setOpen(false);
        setConfirm("end");
      },
    },
    {
      label: "Reopen Campaign",
      hide: inTrash || status !== "ended" || context === "editor",
      onClick: () => {
        setOpen(false);
        setConfirm("reopen");
      },
    },
    {
      label: "Move Campaign",
      href: onMove ? undefined : `/admin/campaigns/${campaign.id}?move=1`,
      hide: inTrash,
      onClick: onMove
        ? () => {
            setOpen(false);
            onMove();
          }
        : undefined,
    },
    {
      label: "Trash Campaign",
      hide: inTrash,
      onClick: () => {
        setOpen(false);
        setConfirm("trash");
      },
    },
    {
      label: "Restore Campaign",
      hide: !inTrash,
      onClick: () => {
        startTransition(async () => {
          try {
            await restoreCampaign(campaign.id);
            toast("✓ Campaign restored");
            setOpen(false);
            router.refresh();
          } catch (error) {
            rethrowNextNavigation(error);
            toast(toUserError(error, "Could not restore"), "error");
          }
        });
      },
    },
    {
      label: "Delete Permanently",
      hide: !inTrash,
      onClick: () => {
        setOpen(false);
        setConfirm("deleteForever");
      },
    },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-icon-btn"
        aria-label="Campaign actions"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div ref={menuRef} className="admin-menu" role="menu">
          {items
            .filter((item) => !item.hide)
            .map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="admin-menu__item"
                  role="menuitem"
                  target={item.href.includes("/preview") ? "_blank" : undefined}
                  rel={
                    item.href.includes("/preview")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="admin-menu__item"
                  role="menuitem"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    item.onClick?.();
                  }}
                >
                  {item.label}
                </button>
              ),
            )}
          {clientId && !inTrash ? (
            <Link
              href={`/admin/clients/${clientId}`}
              className="admin-menu__item"
              role="menuitem"
              onClick={(e) => e.stopPropagation()}
            >
              View Client
            </Link>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "end"}
        title="End Campaign?"
        body="This will mark the campaign as finished and disable access to the client report. All campaign data, TikTok posts, analytics and history will remain saved. You can reopen the campaign later."
        confirmLabel="End Campaign"
        pendingLabel="Ending…"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await endCampaign(campaign.id);
              toast("✓ Campaign Ended");
              setConfirm(null);
              router.refresh();
            } catch (error) {
              rethrowNextNavigation(error);
              toast(toUserError(error, "Could not end campaign"), "error");
            }
          });
        }}
      />
      <ConfirmDialog
        open={confirm === "reopen"}
        title="Reopen Campaign?"
        body="The campaign will become active again and the existing client report link will become accessible."
        confirmLabel="Reopen Campaign"
        pendingLabel="Reopening…"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await reopenCampaign(campaign.id);
              toast("Campaign Active ✓");
              setConfirm(null);
              router.refresh();
            } catch (error) {
              rethrowNextNavigation(error);
              toast(toUserError(error, "Could not reopen campaign"), "error");
            }
          });
        }}
      />
      <ConfirmDialog
        open={confirm === "trash"}
        title="Move campaign to Trash?"
        body="Use Trash for mistakes. Posts and history are kept and can be restored. The client report link will be disabled."
        confirmLabel="Move to Trash"
        pendingLabel="Moving…"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await trashCampaign(campaign.id);
            } catch (error) {
              rethrowNextNavigation(error);
              toast(toUserError(error, "Could not trash campaign"), "error");
            }
          });
        }}
      />
      <ConfirmDialog
        open={confirm === "deleteForever"}
        title="Delete campaign permanently?"
        body="This permanently removes the campaign, posts, metrics and report link. This cannot be undone."
        confirmLabel="Delete Permanently"
        pendingLabel="Deleting…"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await permanentlyDeleteCampaign(campaign.id);
            } catch (error) {
              rethrowNextNavigation(error);
              toast(toUserError(error, "Could not delete campaign"), "error");
            }
          });
        }}
      />
    </div>
  );
}
