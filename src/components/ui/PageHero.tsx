import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  onDark?: boolean;
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  onDark = true,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b section-pad pt-10 md:pt-14 lg:pt-16",
        onDark
          ? "border-border-dark bg-carbon text-off-white"
          : "border-border-light bg-off-white text-carbon",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-40",
          onDark ? "grid-overlay" : "",
        )}
        aria-hidden="true"
      />
      <Container className="relative">
        <div className="max-w-4xl">
          {eyebrow ? (
            <p
              className={cn(
                "label-caps mb-5",
                onDark ? "text-acid-lime" : "text-lime-on-light",
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-[length:var(--text-h1)] font-semibold tracking-[-0.035em] text-balance">
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-6 max-w-2xl text-[length:var(--text-body-lg)] leading-relaxed",
                onDark ? "text-soft-grey" : "text-muted-grey",
              )}
            >
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </Container>
    </section>
  );
}
