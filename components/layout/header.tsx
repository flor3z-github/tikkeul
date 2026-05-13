import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("mb-6 flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em] leading-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
