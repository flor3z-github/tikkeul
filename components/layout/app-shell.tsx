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
  /**
   * Set on pages that mount their own fixed bottom composer (e.g. the DM
   * chat input). Such pages reserve the input height inside their own
   * scroll container, so AppShell skips its default pb-28 gap to avoid
   * stacking a redundant ~112px of empty space below the last message.
   */
  withFixedComposer?: boolean;
};

export function AppShell({
  children,
  className,
  withBottomNav = false,
  withFab = false,
  withFixedComposer = false,
}: AppShellProps) {
  // Bottom-fixed UI eats vertical space:
  // - Floating pill nav: --bottom-nav-clearance (globals.css, safe-area 포함)
  // - FAB: 56px tall, sits 16px above the nav (per add-transaction-button.tsx)
  // - FixedComposer: page owns its own padding; AppShell stays out of the way.
  // Padding is constant against the EXPANDED nav — the collapsed pill must
  // never reflow content.
  const padBottom = withFab
    ? "pb-[calc(var(--bottom-nav-clearance)+16px+56px+16px)]"
    : withBottomNav
      ? "pb-[calc(var(--bottom-nav-clearance)+24px)]"
      : withFixedComposer
        ? "pb-0"
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
