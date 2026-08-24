import { cn } from "@/lib/utils";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  as?: "div" | "section" | "article" | "header" | "footer" | "main";
  id?: string;
};

export function Container({
  children,
  className,
  wide = false,
  as: Tag = "div",
  id,
}: ContainerProps) {
  return (
    <Tag
      id={id}
      className={cn(
        "mx-auto w-full px-5 md:px-8 lg:px-12",
        wide ? "max-w-[1440px]" : "max-w-[1280px]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
