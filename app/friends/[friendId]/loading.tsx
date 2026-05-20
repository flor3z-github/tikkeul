import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";

// Visible while the friend detail page resolves the friendship row, profile
// nickname, group list, and membership set. The real page renders the same
// PageHeader once data lands, so the title swap is the only visible diff.
export default function FriendDetailLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard"
            prefetch
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ◀ 대시보드
          </Link>
        }
        title="친구"
      />
    </AppShell>
  );
}
