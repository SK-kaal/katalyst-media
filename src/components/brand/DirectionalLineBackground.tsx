import { cn } from "@/lib/utils";

type DirectionalLineBackgroundProps = {
  className?: string;
  variant?: "dark" | "light" | "cta";
};

export function DirectionalLineBackground({
  className,
  variant = "dark",
}: DirectionalLineBackgroundProps) {
  const stroke =
    variant === "light"
      ? "rgba(13,13,15,0.08)"
      : variant === "cta"
        ? "rgba(198,255,0,0.22)"
        : "rgba(198,255,0,0.12)";

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={`diag-${variant}`}
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <line x1="0" y1="0" x2="0" y2="56" stroke={stroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#diag-${variant})`} />
      <line
        x1="8%"
        y1="18%"
        x2="42%"
        y2="78%"
        stroke={variant === "light" ? "rgba(90,115,0,0.25)" : "rgba(198,255,0,0.28)"}
        strokeWidth="1"
      />
      <line
        x1="58%"
        y1="10%"
        x2="92%"
        y2="70%"
        stroke={variant === "light" ? "rgba(13,13,15,0.12)" : "rgba(255,255,255,0.08)"}
        strokeWidth="1"
      />
    </svg>
  );
}
