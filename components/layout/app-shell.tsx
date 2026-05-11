import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <main className="min-h-dvh bg-background px-5 pb-28 pt-4 text-foreground">
      <div className={cn("mx-auto w-full max-w-md", className)}>{children}</div>
    </main>
  );
}
