import { cn } from "@/lib/utils";
import { BottomTabNav } from "./bottom-tab-nav";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * When true, renders the global 2-tab BottomTabNav and adds enough bottom
   * padding so the content isn't covered by it. Pages that should not show
   * the nav (e.g. /settings) must omit this prop.
   */
  withBottomNav?: boolean;
};

export function AppShell({
  children,
  className,
  withBottomNav = false,
}: AppShellProps) {
  return (
    <>
      <main
        className={cn(
          "min-h-dvh bg-background pt-4 text-foreground",
          "px-5",
          withBottomNav ? "pb-[calc(76px+env(safe-area-inset-bottom)+24px)]" : "pb-28",
        )}
      >
        <div className={cn("mx-auto w-full max-w-md", className)}>
          {children}
        </div>
      </main>
      {withBottomNav ? <BottomTabNav /> : null}
    </>
  );
}
