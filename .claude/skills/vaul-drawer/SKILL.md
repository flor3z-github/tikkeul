---
name: vaul-drawer
description: Comprehensive reference for vaul (the React drawer / bottom sheet library) plus this project's BottomSheet wrapper. Covers full Drawer.Root API (state control, snap points, behavior, appearance, lifecycle), every official pattern (controlled, uncontrolled, non-dismissible, scaled background, all 4 directions, snap points, draggable handle, nested drawers, no-drag zones, custom portal container), the Drawer subcomponent tree (Root, Trigger, Portal, Overlay, Content, Handle, Title, Description, Close, NestedRoot), the project's BottomSheet + useStableNonNull wrappers, the iOS soft-keyboard handler baked into DrawerContent, drag-handling gotchas, and when to choose AlertDialog/Popover instead. Trigger when working with bottom sheets, drawers, vaul, BottomSheet, DrawerContent, sheet animation issues, iOS keyboard with sheets, snap points, nested sheets, side panels, action sheets, or any UI that needs a swipeable modal surface.
user-invocable: false
---

# vaul / BottomSheet — full reference

> **vaul** ([emilkowalski/vaul](https://github.com/emilkowalski/vaul)) is an unstyled, accessible drawer/bottom-sheet primitive for React. Built on Radix UI's Dialog, so it inherits focus trap, ESC handling, ARIA roles, and scroll lock for free. You only style; vaul handles the gestures, animation, and a11y. This project wraps it twice (`components/ui/drawer.tsx` and `components/ui/bottom-sheet.tsx`) and adds an iOS soft-keyboard handler that vaul's built-in repositioner can't get right on short drawers.

---

## Project hard rules (non-negotiable)

1. **Every bottom sheet must go through `BottomSheet` (preferred) or `DrawerContent` (raw).** NEVER call `DrawerPrimitive.Content` directly from feature code. Why: `DrawerContent` owns the iOS keyboard handler and the close-animation lifecycle; bypassing it means rediscovering bugs we already fixed.
2. **Never replicate sheet markup elsewhere** — no copy-pasting `fixed bottom-0 ...` divs. Use the wrapper.
3. **Never "simplify" the iOS keyboard handler** in `drawer.tsx` without first reproducing the bug each removed line was added for. See `### iOS keyboard handling` below.
4. **No vaul `repositionInputs={true}`** in our codebase — it ships disabled in our wrapper because vaul's built-in version mis-handles short drawers. Don't enable it.
5. **Always import from `@/components/ui/drawer` (or `bottom-sheet`), never from `vaul` directly** in feature code. Direct vaul imports are only allowed inside `components/ui/drawer.tsx` itself.

---

## When to use what

| Need | Use |
|---|---|
| Standard mobile bottom sheet with title + body | `BottomSheet` from `@/components/ui/bottom-sheet` |
| Sheet body needs a non-null payload that survives close animation | `BottomSheet` + `useStableNonNull(value)` |
| Sheet inside another sheet | `Drawer.NestedRoot` — wrap as `BottomSheetNested` first (see "Nesting" below) |
| Side panel (left/right) | `Drawer` directly with `direction="left"` / `"right"` (no `BottomSheet` wrapper) |
| Top sheet / banner | `Drawer` with `direction="top"` |
| Multi-stage drawer (mini → full) | `Drawer` + `snapPoints` + `Drawer.Handle` (we don't use this yet) |
| Confirmation / destructive action | shadcn `AlertDialog`, NOT vaul |
| Persistent menu / picker without overlay | shadcn `Popover` or `DropdownMenu` |

---

## Install / import

```bash
pnpm add vaul          # already installed
```

```tsx
// Feature code:
import {
  Drawer,                // vaul Root wrapper (we override repositionInputs to false)
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,         // owns iOS keyboard handling
  DrawerClose,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

import {
  BottomSheet,           // canonical wrapper — use this 99% of the time
  useStableNonNull,      // for value-based sheets
} from "@/components/ui/bottom-sheet";
```

---

## Pattern catalog (every official vaul pattern)

### 1) Uncontrolled — opens via Trigger, closes via Close / swipe / overlay

```tsx
import { Drawer } from "vaul";

<Drawer.Root>
  <Drawer.Trigger asChild>
    <button>Open</button>
  </Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 inset-x-0 bg-white rounded-t-lg p-4 h-[96%]">
      <Drawer.Title>Title</Drawer.Title>
      <Drawer.Description>Description</Drawer.Description>
      <Drawer.Close>Close</Drawer.Close>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### 2) Controlled — external `useState`

```tsx
const [open, setOpen] = useState(false);

<Drawer.Root open={open} onOpenChange={setOpen}>
  <Drawer.Trigger asChild><button>Open</button></Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="...">
      <button onClick={() => setOpen(false)}>Close programmatically</button>
      <Drawer.Close>Close via Drawer.Close</Drawer.Close>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

> Both patterns work in our wrappers. `BottomSheet` is always controlled (you pass `open` + `onOpenChange`).

### 3) Non-dismissible — must be controlled, must provide own close

```tsx
const [open, setOpen] = useState(true);

<Drawer.Root open={open} onOpenChange={setOpen} dismissible={false}>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="...">
      <p>You must explicitly accept to continue.</p>
      <button onClick={() => setOpen(false)}>I accept</button>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

`dismissible={false}` blocks swipe-to-close, overlay click, and ESC. **Always pair with controlled state** — without it, the drawer is uncloseable.

### 4) iOS-style background scaling

Requires `data-vaul-drawer-wrapper` on the app shell (the element vaul should scale).

```tsx
<div data-vaul-drawer-wrapper="" className="h-screen w-screen bg-white">
  <Drawer.Root shouldScaleBackground>
    <Drawer.Trigger asChild><button>Open</button></Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 bg-black/40" />
      <Drawer.Content className="fixed bottom-0 inset-x-0 bg-white rounded-t-lg p-4 h-[96%]">
        <Drawer.Title>Scaled background</Drawer.Title>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
</div>
```

We don't currently use `shouldScaleBackground` — turning it on requires marking the right wrapper element and verifying it doesn't fight `BottomTabNav`'s `position: fixed`.

### 5) Direction — top / bottom / left / right

```tsx
function DirectionalDrawer({ direction }: { direction: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    bottom: "bottom-0 left-0 right-0 h-[50%] rounded-t-lg",
    top:    "top-0 left-0 right-0 h-[50%] rounded-b-lg",
    left:   "left-0 top-0 bottom-0 w-[300px] rounded-r-lg",
    right:  "right-0 top-0 bottom-0 w-[300px] rounded-l-lg",
  };
  return (
    <Drawer.Root direction={direction}>
      <Drawer.Trigger asChild><button>Open {direction}</button></Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className={`fixed bg-white p-6 ${positionClasses[direction]}`}>
          <Drawer.Title>From {direction}</Drawer.Title>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

`BottomSheet` only handles `direction="bottom"`. For side panels, drop down to raw `Drawer` + custom Tailwind. Don't try to fold side direction into `BottomSheet`.

### 6) Snap points — multi-stage drawer

```tsx
const snapPoints = ["148px", "355px", 1];
const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

<Drawer.Root
  snapPoints={snapPoints}
  activeSnapPoint={snap}
  setActiveSnapPoint={setSnap}
  fadeFromIndex={1}                 // overlay starts fading from snapPoints[1]
>
  <Drawer.Trigger asChild><button>Open</button></Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 inset-x-0 bg-white rounded-t-lg h-full max-h-[97%]">
      <div className={snap === 1 ? "overflow-y-auto" : "overflow-hidden"}>
        <h2>Multi-stage</h2>
        <p>Snap: {String(snap)}</p>
      </div>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

Notes:
- Snap point values: `number 0..1` = fraction of viewport height, or `"<px>px"` string = absolute pixels.
- `activeSnapPoint` + `setActiveSnapPoint` are required when `snapPoints` is set — vaul controls the position via this state.
- `fadeFromIndex` controls when the overlay starts fading: `0` = always fade, higher = stay opaque until that snap point.
- `snapToSequentialPoint` (default `false`) — if `true`, drawer can only move one snap step per gesture (no skipping).
- Switch the inner scroller's overflow based on `snap` so the body only scrolls when fully expanded.

### 7) Snap points + draggable handle indicator

```tsx
<Drawer.Root snapPoints={snapPoints} activeSnapPoint={snap} setActiveSnapPoint={setSnap}>
  <Drawer.Trigger asChild><button>Open</button></Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 inset-x-0 bg-white rounded-t-lg h-full max-h-[97%]">
      <Drawer.Handle className="mx-auto mt-4 w-12 h-1.5 rounded-full bg-gray-300" />
      <div className="p-4">…</div>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

`Drawer.Handle` is the visible handle bar. Dragging or tapping it cycles through snap points. `preventCycle={true}` disables the tap-to-cycle behavior (drag still works).

> Our `DrawerContent` already renders a handle bar by default (`showHandle = true`). Don't add a second one inside the body.

### 8) Nested drawers — `Drawer.NestedRoot`

```tsx
<Drawer.Root>
  <Drawer.Trigger asChild><button>Open parent</button></Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 inset-x-0 bg-white rounded-t-lg p-4 h-[96%]">
      <Drawer.Title>Parent</Drawer.Title>

      <Drawer.NestedRoot>
        <Drawer.Trigger asChild><button>Open nested</button></Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content className="fixed bottom-0 inset-x-0 bg-gray-100 rounded-t-lg p-4 h-[94%]">
            <Drawer.Title>Nested</Drawer.Title>
            <Drawer.Close>Close nested</Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.NestedRoot>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

Parent automatically scales/repositions when nested opens, restores when nested closes. **Use `NestedRoot`, NOT another `Drawer.Root`** — a second Root creates a separate stack and looks wrong.

> **Project status:** `components/ui/drawer.tsx` does NOT yet export `DrawerNestedRoot`. To add: mirror the existing `Drawer` wrapper but use `DrawerPrimitive.NestedRoot` and force `repositionInputs={false}`. Then add a `BottomSheetNested` to `components/ui/bottom-sheet.tsx` that takes the same props as `BottomSheet` but uses `DrawerNestedRoot`. The iOS keyboard logic on `DrawerContent` works inside nested roots automatically.

### 9) `data-vaul-no-drag` — exclude touch zones from drawer drag

```tsx
<Drawer.Content className="...">
  <Drawer.Title>With slider</Drawer.Title>
  <div data-vaul-no-drag className="my-4">
    <input type="range" min="0" max="100" className="w-full" />
  </div>
  <div data-vaul-no-drag className="overflow-x-auto flex gap-4 p-4">
    {/* horizontal carousel */}
  </div>
</Drawer.Content>
```

Apply on any element that owns its own touch interaction: sliders, carousels, signature pads, custom horizontal scrollers. Without it, vaul intercepts the touch and starts dragging the sheet down.

### 10) Custom portal container

```tsx
<Drawer.Root container={document.getElementById("custom-portal")}>
  …
</Drawer.Root>
```

Default = `document.body`. Useful if you need the sheet inside a specific stacking context (e.g. a modal-within-modal scenario, or a Storybook iframe).

### 11) Disable default drag, gate it behind the handle

```tsx
<Drawer.Root handleOnly>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content className="...">
      <Drawer.Handle />          {/* only this triggers drag */}
      <div>…body cannot drag the sheet…</div>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

`handleOnly={true}` confines drag to `Drawer.Handle`. Useful when the body is densely interactive (forms, lists with row swipes) and you don't want body touches to start sheet drags.

### 12) Lifecycle callbacks

```tsx
<Drawer.Root
  onOpenChange={(open) => log("openChange", open)}
  onDrag={(e, percent) => log("drag", percent)}        // 0..1 progress
  onRelease={(e, willOpen) => log("release", willOpen)} // willOpen = vaul's prediction
  onClose={() => log("close")}                          // fires after close animation
  onAnimationEnd={(open) => log("anim end", open)}      // open + close
>
  …
</Drawer.Root>
```

`onAnimationEnd` is the right hook for "do X after the close animation finishes" (e.g. clearing state). `onClose` runs at the same point but only on close.

---

## Drawer.Root — full props reference

```tsx
<Drawer.Root
  // ── State control ──
  open={false}                  // controlled
  defaultOpen={false}           // uncontrolled initial
  onOpenChange={(open) => {}}

  // ── Snap points ──
  snapPoints={[0.25, 0.5, 1]}   // number = fraction of vh, "Npx" = absolute
  activeSnapPoint={0.5}
  setActiveSnapPoint={(snap) => {}}
  fadeFromIndex={2}             // overlay opacity starts fading from this index
  snapToSequentialPoint={false} // true = no snap-skipping

  // ── Behavior ──
  dismissible={true}            // false = no swipe / esc / overlay-click close
  modal={true}                  // false = allow background interaction
  handleOnly={false}            // true = drag only fires on Drawer.Handle
  direction="bottom"            // 'top' | 'bottom' | 'left' | 'right'
  closeThreshold={0.25}         // drag distance fraction needed to close
  scrollLockTimeout={500}       // ms — debounce inner-scroll detection
  fixed={false}                 // true = treat Content as a fixed element (no drag tracking)
  repositionInputs={true}       // vaul iOS keyboard helper — WE DISABLE THIS in our wrapper
  preventScrollRestoration={false}
  autoFocus={false}             // true = focus first focusable on open
  container={null}              // alternate portal container (default: document.body)

  // ── Appearance ──
  shouldScaleBackground={false}     // needs data-vaul-drawer-wrapper on app shell
  setBackgroundColorOnScale={true}  // pairs with shouldScaleBackground
  noBodyStyles={false}              // true = don't lock body scroll

  // ── Lifecycle ──
  onDrag={(e, percent) => {}}
  onRelease={(e, willOpen) => {}}
  onClose={() => {}}
  onAnimationEnd={(open) => {}}
>
```

---

## Subcomponents

| Component | Purpose | Notes |
|---|---|---|
| `Drawer.Root` | State + lifecycle wrapper | Required outermost. |
| `Drawer.NestedRoot` | Nested sheet wrapper | Use inside another Drawer.Content for nesting. |
| `Drawer.Trigger` | Opens the drawer | Use `asChild` to compose with your button. |
| `Drawer.Portal` | Teleports children to `container` (default body) | Wraps Overlay + Content. |
| `Drawer.Overlay` | Background scrim | Click to close (if dismissible). Style with Tailwind. |
| `Drawer.Content` | The sheet itself | Position with `fixed bottom-0` + size. Owns gesture surface. |
| `Drawer.Handle` | Visible drag handle | Optional. `preventCycle={true}` disables tap-to-cycle. |
| `Drawer.Title` | a11y title (Radix) | Required — falls back to SR-only if you don't want to show it. |
| `Drawer.Description` | a11y description | Same — required. |
| `Drawer.Close` | Closes the drawer | Use `asChild` to compose with your button. |

---

## Project-local extensions

### `BottomSheet` wrapper — use this 99% of the time

`components/ui/bottom-sheet.tsx`:

```tsx
<BottomSheet
  open={open}
  onOpenChange={setOpen}
  title="제목"
  subtitle="옵션 — 보조 식별자"
  description="스크린리더용 — Radix a11y 요구사항"
  showCloseButton={false}
>
  {/* body */}
</BottomSheet>
```

What it bakes in:
- The canonical Tailwind class set: `border-white/10 bg-background px-5 pb-8 pt-2`, `rounded-t-[28px]`.
- Always-mounted `<Drawer>` driven by `open` so vaul can play the slide-down animation when you flip `open` to `false`.
- `DrawerHeader` with the project's standard 22px-bold title typography.
- SR-only `DrawerDescription` (Radix requires a description).
- Optional X close button (top-right) via `showCloseButton`.

### `useStableNonNull(value)` — for value-based sheets

```tsx
const stable = useStableNonNull(target);
return (
  <BottomSheet open={target !== null} onOpenChange={() => setTarget(null)} title={...} description={...}>
    {stable ? <Body item={stable} /> : null}
  </BottomSheet>
);
```

Without it: when the parent flips `target = null`, the body unmounts immediately and the sheet collapses mid-animation. With it: the body keeps the previous non-null payload until vaul finishes the slide-down. Implemented with the React "adjusting state when a prop changes" pattern (no refs accessed during render — our lint rule forbids that).

### iOS keyboard handling (already baked into `DrawerContent`)

The wrapper in `components/ui/drawer.tsx` overrides vaul's `repositionInputs` to **false** because vaul's built-in handler toggles `keyboardIsOpen` on every `visualViewport.resize` over 60px and ends up with a stale top offset on short drawers (sheet ends up behind the keyboard or pushed above the viewport top). We replace it with our own `applyKeyboardInset` effect:

1. Listens to `visualViewport.resize` AND `visualViewport.scroll` (iOS scrolls the layout viewport on text-input focus — quirk #2).
2. Treats any vv.height shrink > 100px as a keyboard event (ignores Mobile Safari's URL-bar shrink, which is ~50–80px).
3. Anchors the sheet's `bottom` to the visualViewport's bottom edge: `window.innerHeight - vv.offsetTop - vv.height`.
4. Clamps `maxHeight` to `vv.height` so a tall sheet's top edge can't slide above the visible area.
5. Drops `paddingBottom` while the keyboard is up so the sheet sits flush against it.
6. Re-runs on `focusin` / `focusout` (rAF + 100ms + 300ms) — iOS sometimes fires the resize before reflow, and switching numeric→QWERTY changes both `vv.height` and `vv.offsetTop` in one gesture without a discrete blur+focus cycle.
7. Skips the rewrite while `data-state="closed"` so the close animation doesn't snap from lifted to 0 mid-animation.

**Don't "simplify" any of these — each one was a bug fix.** If you're tempted to remove a listener, check the comments in `drawer.tsx` first. If your sheet has no text inputs (e.g. an action sheet), the handler is harmless overhead — leave it.

The inner scroller (`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain`) is also part of `DrawerContent`. Long body content scrolls inside it instead of overflowing the viewport. `min-h-0` is required for the flex child to actually shrink and let overflow take effect.

---

## Common gotchas

- **Sheet flashes content from the previous open** → you're rendering body conditionally with the same `open` flag. Use `useStableNonNull` for value-based bodies, or always render the body and let `open` control visibility.
- **Swipe down on a long list closes the sheet** → make sure the inner scroller is the touch target. `DrawerContent` already wires this; don't put your list as a sibling of the scroller.
- **No focus on the first input** → `autoFocus` defaults to `false`. Flip it true only when you genuinely want auto-focus. With `Drawer.Description` set (Radix a11y), Radix may grab initial focus to the close button instead.
- **Stacked drawers visually wrong** → use `Drawer.NestedRoot` for the inner one, not `Drawer.Root`.
- **`Cannot read property 'height' of null` in dev / SSR** → `window.visualViewport` is undefined in SSR or some test envs. Our effect early-returns when `vv` is missing; mirror that in any custom keyboard logic you add.
- **Background scrolls behind the sheet** → don't pass `noBodyStyles={true}` unless you've manually re-implemented body scroll lock.
- **Submit-on-Enter inside a sheet form fires twice** → vaul's keyboard handling and the form's submit both touch `focusout` and visualViewport. Use explicit submit buttons; avoid `onSubmit` + `onBlur` debouncing that race.
- **Drawer body content doesn't drag the sheet down** → check that you didn't accidentally apply `data-vaul-no-drag` on the wrapping element. That attribute is sticky to descendants.
- **Snap-point drawer overflows on small viewports** → add `max-h-[97%]` to `Content` so the largest snap doesn't push past the viewport top. The official examples all use this clamp.
- **Side drawer (`direction="left"`) closes when scrolling horizontal content** → wrap that scroller in `data-vaul-no-drag`.

---

## When NOT to use vaul

- **Confirmations / destructive actions** → shadcn `AlertDialog`. Vaul is overkill and the swipe gesture is wrong UX for "are you sure?".
- **Persistent navigation surfaces** → `BottomTabNav`, not a drawer.
- **Non-modal popovers / pickers** → shadcn `Popover` or `DropdownMenu`.
- **Toasts / snackbars** → `sonner` (we already use it).
- **Full-page transitions** → just navigate (`router.push`). A drawer that fills the viewport is an anti-pattern; use a route.

---

## Reference

- vaul GitHub: https://github.com/emilkowalski/vaul
- vaul site: https://vaul.emilkowal.ski
- Project files: `components/ui/drawer.tsx`, `components/ui/bottom-sheet.tsx`
- `DESIGN.md` §9.4 — when sheets are allowed in the app
- Radix Dialog (vaul's foundation): https://www.radix-ui.com/primitives/docs/components/dialog
