## 티끌 (Tikkeul) UI kit — how to build with it

These are the shadcn `base-nova` primitives behind 티끌, a Korean
personal-spending PWA. Mobile-first: design for a single column, `max-w-md`
(~28rem) wide, on a light `bg-background` (#f5f5f7) page. Korean copy.

### Setup — no provider needed

Components are styled entirely by `styles.css` (it `@import`s the design tokens
+ Tailwind utilities and `_ds_bundle.css`). There is **no theme/context
provider to wrap** — tokens are plain CSS variables on `:root`, light mode only.
Just render a component and it's styled. The brand font is **Pretendard**
(`--font-sans`), shipped in `fonts/`.

### Styling idiom — Tailwind v4 utilities over CSS-variable tokens

Style your own layout glue with Tailwind utility classes that map to the design
tokens — **use these token utilities, not raw hex**:

| Surface / text | Utility |
|---|---|
| page bg / default text | `bg-background` / `text-foreground` |
| card surface | `bg-card` `text-card-foreground` |
| brand / accent action | `bg-primary` `text-primary-foreground` (#007aff) |
| secondary fill | `bg-secondary` `text-secondary-foreground` |
| muted fill / subtle text | `bg-muted` / `text-muted-foreground` |
| destructive | `bg-destructive` / `text-destructive` (#ff3b30) |
| hairline border | `border-border`, inputs `border-input` |

Interactive components (Button, Input, Switch…) carry their own focus ring — you
don't add one.

Radii come from `--radius` (1.125rem): `rounded-lg` (cards), `rounded-xl`,
`rounded-full` (switches/badges). Status colors also exist as raw vars
`--success` `--warning` `--danger` for inline `style` when no utility fits.
Spacing/type are stock Tailwind (`gap-2`, `px-4`, `text-sm`). The type scale
shipped here tops out at `text-xl` — for the **big spending hero numbers** the
product is built around, use an inline `style={{ fontSize: 30, fontWeight: 700 }}`
rather than a larger text-* class that won't resolve. Don't invent class names
outside this vocabulary — anything not in the compiled stylesheet won't resolve.

### Where the truth lives

- `styles.css` → its `@import` closure (`_ds_bundle.css`) is the full token +
  utility set. Read it before styling.
- Each component's `<Name>.d.ts` is its real prop API; `<Name>.prompt.md` has
  usage. Read those before composing a component.

### Components

This kit is scoped to what 티끌 actually uses. Primary: **Button** (`variant`
default/secondary/outline/ghost/destructive — outline & ghost dominate; `size`
sm/default/lg/icon/icon-sm — icon buttons are common), **Card** + **CardContent**
(a rounded container holding a list — the app composes only these two, e.g.
`<Card className="rounded-3xl py-2"><CardContent className="p-2">…`), **Input**,
**Label** (`htmlFor` an input or wrap a control), **Switch** (`defaultChecked`,
`size` sm/default), **RadioGroup** + `RadioGroupItem` (`value` per option, wrap
each in a `Label`), **Calendar** (`mode="single"`), **Skeleton** (size via
`style`/className), **Popover** (`PopoverTrigger` + `PopoverContent`). Overlays
**AlertDialog**, **Drawer**/**BottomSheet** (bottom sheet — the app's modal of
choice, not Dialog) and the **Toaster** (sonner) ship importable; compose them
from their `.d.ts`. (`Badge` and the whole `Dialog` family are bundle-exported
but the app doesn't use them — no preview card.)

### One idiomatic snippet

```tsx
<Card className="rounded-3xl py-2 shadow-none">
  <CardContent className="p-2">
    <ul>
      <li className="flex items-center justify-between px-3 py-2 text-sm">
        <span>점심</span>
        <span className="font-semibold">₩9,500</span>
      </li>
    </ul>
  </CardContent>
</Card>
```
