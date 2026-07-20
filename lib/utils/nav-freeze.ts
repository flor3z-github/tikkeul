// Ref-counted freeze flag for the bottom nav's scroll-collapse behavior.
// While any bottom sheet is open, iOS keyboard focus scrolls the *layout*
// viewport (see components/ui/drawer.tsx), which fires window scroll events
// and would toggle the nav behind the sheet — freeze suppresses that.
type ApplyFrozen = (frozen: boolean) => void;

export function createNavFreeze(apply: ApplyFrozen) {
  let count = 0;
  return {
    acquire() {
      count += 1;
      if (count === 1) apply(true);
    },
    release() {
      if (count === 0) return;
      count -= 1;
      if (count === 0) apply(false);
    },
    get frozen() {
      return count > 0;
    },
  };
}

// Module-level singleton shared by DrawerContent (acquire/release) and
// useNavCollapsed (reads .frozen). The dataset write is for debuggability
// only — consumers read the getter, not the DOM.
export const navFreeze = createNavFreeze((frozen) => {
  if (typeof document === "undefined") return;
  if (frozen) document.documentElement.dataset.navFreeze = "1";
  else delete document.documentElement.dataset.navFreeze;
});
