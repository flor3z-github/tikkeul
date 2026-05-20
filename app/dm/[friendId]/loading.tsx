import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";

// Shown while the DM thread page resolves the friendship + thread + latest
// messages. The real page swaps in its own sticky header inside DmChat once
// the data lands; until then this gives the user the back affordance and a
// stable title slot instead of a blank screen.
export default function DmThreadLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/dm"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            메시지
          </Link>
        }
        title="DM"
      />
    </AppShell>
  );
}
