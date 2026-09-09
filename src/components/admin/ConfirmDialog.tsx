"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="admin-modal-root"
          role="presentation"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
        >
          <button
            type="button"
            className="admin-modal-backdrop"
            aria-label="Close dialog"
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="admin-modal"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.18 }}
          >
            <h2 id={titleId} className="font-display text-xl font-semibold tracking-[-0.03em]">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-soft-grey">{body}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={onCancel}
                disabled={pending}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`admin-btn ${danger ? "admin-btn--danger" : "admin-btn--primary"}`}
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
