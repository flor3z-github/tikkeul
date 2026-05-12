"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  Icon: typeof Wallet;
};

const TABS: Tab[] = [
  { href: "/dashboard", label: "이번 달", Icon: Wallet },
  { href: "/fixed-expenses", label: "고정지출", Icon: CalendarDays },
];

export function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 네비게이션"
      className="pointer-events-none fixed inset-x-0 z-40"
      style={{ bottom: 0 }}
    >
      <div
        className="pointer-events-auto mx-auto w-full max-w-md border-t border-border bg-background"
        style={{
          paddingTop: "12px",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <ul className="grid grid-cols-2">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
