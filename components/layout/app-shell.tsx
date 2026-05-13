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
  /**
   * When true, adds extra bottom padding so content can scroll above the
   * floating add-transaction FAB. Use on pages that mount AddTransactionButton.
   */
  withFab?: boolean;
};

export function AppShell({
  children,
  className,
  withBottomNav = false,
  withFab = false,
}: AppShellProps) {
  // Bottom-fixed UI eats vertical space:
  // - BottomTabNav: 76px + safe-area
  // - FAB: 56px tall, sits 16px above the nav (per add-transaction-button.tsx)
  // The content needs to scroll past whichever extends higher, plus a small gap.
  const padBottom = withFab
    ? "pb-[calc(76px+env(safe-area-inset-bottom)+16px+56px+16px)]"
    : withBottomNav
      ? "pb-[calc(76px+env(safe-area-inset-bottom)+24px)]"
      : "pb-28";

  return (
    <>
      <main
        className={cn(
          "min-h-dvh bg-background pt-4 text-foreground",
          "px-5",
          padBottom,
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
