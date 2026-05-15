import { redirect } from "next/navigation";

// The dedicated /friends page has been folded into the dashboard:
//   - friend list / switching → header omnibox sheet
//   - add friend (issue/redeem) → nested sheet inside the omnibox
//   - per-friend visibility / removal → /friends/[friendId]
// The bare /friends route is kept only so existing bookmarks land somewhere
// useful instead of 404'ing.
export default function FriendsIndex() {
  redirect("/dashboard");
}
