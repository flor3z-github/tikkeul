import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  trailing,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("mb-6 flex items-start justify-between gap-3", className)}
    >
      <div>
        {eyebrow ? (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em] leading-tight">
          {title}
        </h1>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
