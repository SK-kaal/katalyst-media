"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { DirectionalLineBackground } from "@/components/brand/DirectionalLineBackground";
import { Wordmark } from "@/components/ui/Wordmark";
import {
  submitAccessCodeAction,
  type AccessCodeState,
} from "@/lib/admin-auth/actions";

export default function LoginForm() {
  const [showCode, setShowCode] = useState(false);
  const [state, formAction, pending] = useActionState<AccessCodeState | null, FormData>(
    submitAccessCodeAction,
    null,
  );

  return (
    <div className="admin-login">
      <DirectionalLineBackground className="opacity-[0.35]" />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_left,rgba(198,255,0,0.08),transparent_65%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_right,rgba(198,255,0,0.06),transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mb-8 text-center">
        <Wordmark className="text-[1.05rem] tracking-[0.14em]" />
      </div>

      <div className="admin-login__card">
        <p className="label-caps text-[0.68rem] tracking-[0.14em] text-acid-lime">
          Private Portal
        </p>
        <h1 className="mt-3 font-display text-[1.85rem] font-semibold tracking-[-0.04em]">
          Enter access code
        </h1>
        <p className="mt-2 text-sm text-soft-grey">
          Authorised Katalyst staff only.
        </p>

        <form className="mt-7 space-y-4" action={formAction} noValidate>
          <div>
            <label className="admin-label" htmlFor="access-code">
              Access code
            </label>
            <div className="relative">
              <input
                id="access-code"
                name="code"
                className="admin-input pr-16 tracking-[0.35em]"
                type={showCode ? "text" : "password"}
                autoComplete="one-time-code"
                inputMode="text"
                spellCheck={false}
                autoFocus
                aria-invalid={state?.error ? true : undefined}
                aria-describedby={state?.error ? "access-code-error" : undefined}
                placeholder="••••••••"
                disabled={pending}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-grey hover:text-off-white"
                aria-label={showCode ? "Hide code" : "Show code"}
                onClick={() => setShowCode((v) => !v)}
                disabled={pending}
              >
                {showCode ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {state?.error ? (
            <p
              id="access-code-error"
              className="whitespace-pre-line text-sm text-[#ff8f8f]"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          {pending ? (
            <p className="text-sm text-acid-lime" role="status">
              Checking…
            </p>
          ) : null}

          <button
            type="submit"
            className="admin-btn admin-btn--primary w-full"
            disabled={pending}
          >
            {pending ? "Checking…" : "Enter Portal"}
          </button>
        </form>

        <p className="mt-6 flex items-center gap-3 text-center text-[0.72rem] text-muted-grey">
          <span className="h-px flex-1 bg-white/10" />
          Authorised users only.
          <span className="h-px flex-1 bg-white/10" />
        </p>
      </div>
    </div>
  );
}
