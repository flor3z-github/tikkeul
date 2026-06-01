// Push notifications cold-launch the PWA at the manifest start_url ("/") with
// the real deep target in the `next` query param (see app/sw.ts). app/page.tsx
// forwards `next` only after validating it here, so the cold-start redirect
// can't be turned into an open redirect to an attacker-controlled origin.
//
// Allowed internal targets:
//   /dashboard...  — notify-friend-spending (friend spending pushes)
//   /dm/...        — notify-dm-message (friend reactions/comments + DM messages)
//
// The trailing `(?:[/?#]|$)` boundary stops prefix-escape lookalikes such as
// "/dashboardx" or "/dmfoo" from matching, and requiring a leading single "/"
// rejects "//evil.com" (protocol-relative) and "https://evil.com" (absolute).
const ALLOWED_DEEP_LINK = /^\/(dashboard|dm)(?:[/?#]|$)/;

const DEFAULT_TARGET = "/dashboard";

// Resolve the post-login redirect target from a notification's `next` param.
// Returns `next` verbatim when it is a known internal deep-link, otherwise the
// dashboard fallback. Never returns an off-origin URL.
export function resolveNextTarget(next: string | undefined | null): string {
  return next && ALLOWED_DEEP_LINK.test(next) ? next : DEFAULT_TARGET;
}
