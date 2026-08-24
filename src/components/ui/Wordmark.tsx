import Link from "next/link";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  onDark?: boolean;
  href?: string;
};

export function Wordmark({ className, onDark = true, href = "/" }: WordmarkProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-baseline gap-[0.35em] font-display text-[0.95rem] font-semibold tracking-[0.14em] uppercase",
        className,
      )}
    >
      <span className={onDark ? "text-off-white" : "text-carbon"}>Katalyst</span>
      <span className="text-acid-lime">Media</span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex focus-visible:outline-offset-4" aria-label="Katalyst Media home">
      {content}
    </Link>
  );
}
