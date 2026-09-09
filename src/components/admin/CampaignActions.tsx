"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  refreshCampaignPosts,
  setCampaignStatus,
} from "@/lib/portal/actions";
import { toUserError } from "@/lib/portal/errors";
import { company } from "@/content/company";
import type { Campaign, CampaignStatus } from "@/lib/supabase/database.types";

export function CampaignActionsMenu({
  campaign,
  clientId,
}: {
  campaign: Pick<
    Campaign,
    "id" | "status" | "share_token" | "share_enabled"
  >;
  clientId?: string;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"pause" | "close" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const status = campaign.status as CampaignStatus;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  const runStatus = (next: CampaignStatus, message: string) => {
    startTransition(async () => {
      try {
        await setCampaignStatus(campaign.id, next);
        toast(message.startsWith("✓") ? message : `✓ ${message}`);
        setConfirm(null);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast(
          toUserError(error, "Could not update campaign"),
          "error",
        );
      }
    });
  };

  const items: {
    label: string;
    onClick?: () => void;
    href?: string;
    hide?: boolean;
  }[] = [
    {
      label: "Open Campaign",
      href: `/admin/campaigns/${campaign.id}`,
    },
    {
      label: "Preview Client Report",
      href: campaign.share_token
        ? `/report/${campaign.share_token}`
        : undefined,
      hide: !campaign.share_token,
    },
    {
      label: "Copy Client Link",
      hide: !(campaign.share_enabled && campaign.share_token),
      onClick: async () => {
        if (!campaign.share_token) return;
        await navigator.clipboard.writeText(
          `${company.url}/report/${campaign.share_token}`,
        );
        toast("Client link copied");
        setOpen(false);
      },
    },
    {
      label: "Refresh Data",
      hide: status === "draft",
      onClick: () => {
        startTransition(async () => {
          try {
            const result = await refreshCampaignPosts(campaign.id);
            toast(
              `${result.updated}/${result.total} posts refreshed`,
            );
            setOpen(false);
            router.refresh();
          } catch (error) {
            toast(
              error instanceof Error ? error.message : "Refresh failed",
              "error",
            );
          }
        });
      },
    },
    {
      label: "Pause Campaign",
      hide: status !== "live",
      onClick: () => setConfirm("pause"),
    },
    {
      label: "Resume Campaign",
      hide: status !== "paused",
      onClick: () => runStatus("live", "Campaign resumed"),
    },
    {
      label: "Close Campaign",
      hide: status === "closed" || status === "draft",
      onClick: () => setConfirm("close"),
    },
    {
      label: "Reopen Campaign",
      hide: status !== "closed",
      onClick: () => runStatus("live", "Campaign reopened"),
    },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
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
        <div className="admin-menu" role="menu">
          {items
            .filter((item) => !item.hide)
            .map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="admin-menu__item"
                  target={item.href.startsWith("/report/") ? "_blank" : undefined}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="admin-menu__item"
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
          {clientId ? (
            <Link
              href={`/admin/clients/${clientId}`}
              className="admin-menu__item"
              onClick={(e) => e.stopPropagation()}
            >
              View Client
            </Link>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "pause"}
        title="Pause Campaign?"
        body="The campaign will move out of active Live campaigns. You can resume anytime. Data and the client report stay available."
        confirmLabel="Pause"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runStatus("paused", "Campaign paused")}
      />
      <ConfirmDialog
        open={confirm === "close"}
        title="Close Campaign?"
        body="This will stop the campaign from appearing under current campaigns. Historical data and the client report will remain available unless you disable the share link."
        confirmLabel="Close Campaign"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runStatus("closed", "Campaign closed")}
      />
    </div>
  );
}
