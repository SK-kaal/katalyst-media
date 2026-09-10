"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  archiveClient,
  permanentlyDeleteClient,
  restoreClient,
} from "@/lib/portal/actions";
import { rethrowNextNavigation, toUserError } from "@/lib/portal/errors";

export function ClientArchiveActions({
  clientId,
  archived,
  campaignCount,
}: {
  clientId: string;
  archived: boolean;
  campaignCount: number;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const run = (fn: () => Promise<void>, ok: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast(ok.startsWith("✓") ? ok : `✓ ${ok}`);
        setConfirm(null);
        router.refresh();
      } catch (error) {
        rethrowNextNavigation(error);
        toast(toUserError(error, "Could not update client"), "error");
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {archived ? (
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          disabled={pending}
          onClick={() => run(() => restoreClient(clientId), "Client restored")}
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          disabled={pending}
          onClick={() => setConfirm("archive")}
        >
          Archive
        </button>
      )}
      {campaignCount === 0 ? (
        <button
          type="button"
          className="admin-btn admin-btn--ghost text-[#ff8f8f]"
          disabled={pending}
          onClick={() => setConfirm("delete")}
        >
          Delete
        </button>
      ) : null}

      <ConfirmDialog
        open={confirm === "archive"}
        title="Archive client?"
        body="Archived clients leave the active list. Campaigns and reports stay intact and can be restored anytime."
        confirmLabel="Archive Client"
        pendingLabel="Archiving…"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(() => archiveClient(clientId), "Client archived")
        }
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Permanently delete client?"
        body="This client has no campaigns. Deletion cannot be undone."
        confirmLabel="Delete Permanently"
        pendingLabel="Deleting…"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(() => permanentlyDeleteClient(clientId), "Client deleted")
        }
      />
    </div>
  );
}
