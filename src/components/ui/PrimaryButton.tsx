"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  queueSectionScroll,
  scrollToSection,
  sectionIdFromHref,
} from "@/lib/scroll";
import { cn } from "@/lib/utils";

type ButtonBaseProps = {
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
};

type AnchorProps = ButtonBaseProps & {
  href: string;
  onClick?: () => void;
  type?: never;
  disabled?: never;
  external?: boolean;
};

type NativeButtonProps = ButtonBaseProps & {
  href?: never;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  external?: never;
};

type PrimaryButtonProps = AnchorProps | NativeButtonProps;

const primaryClasses =
  "group inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-lime-border bg-acid-lime px-5 py-3.5 text-[0.9375rem] font-medium text-carbon transition-[transform,filter,background-color] duration-200 ease-out hover:-translate-y-px hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid-lime disabled:cursor-not-allowed disabled:opacity-60";

function isPageHash(href: string) {
  return href.startsWith("#") || href.startsWith("/#");
}

export function PrimaryButton(props: PrimaryButtonProps) {
  const pathname = usePathname();
  const { children, className, showArrow = true } = props;
  const hashLink = "href" in props && !!props.href && isPageHash(props.href);
  const Arrow = hashLink ? ArrowDownRight : ArrowUpRight;

  const content = (
    <>
      <span>{children}</span>
      {showArrow ? (
        <Arrow
          className={cn(
            "size-4 transition-transform duration-200 ease-out",
            hashLink
              ? "group-hover:translate-y-[2px]"
              : "group-hover:translate-x-[3px] group-hover:-translate-y-px",
          )}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if ("href" in props && props.href) {
    const isMail = props.href.startsWith("mailto:");
    const external = props.external ?? (props.href.startsWith("http") && !isMail);
    const sectionId = sectionIdFromHref(props.href);

    if (sectionId) {
      return (
        <Link
          href="/"
          scroll={false}
          className={cn(primaryClasses, className)}
          onClick={(event) => {
            props.onClick?.();
            if (pathname === "/") {
              event.preventDefault();
              scrollToSection(sectionId);
              return;
            }
            queueSectionScroll(sectionId);
          }}
        >
          {content}
        </Link>
      );
    }

    if (external || isMail || props.href.startsWith("#")) {
      return (
        <a
          href={props.href}
          onClick={props.onClick}
          className={cn(primaryClasses, className)}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </a>
      );
    }

    return (
      <Link href={props.href} onClick={props.onClick} className={cn(primaryClasses, className)}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(primaryClasses, className)}
    >
      {content}
    </button>
  );
}
