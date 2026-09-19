"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="size-6 rounded-md bg-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">
          Communication Trainer
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              <Link
                href={item.available ? item.href : "#"}
                aria-disabled={!item.available}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  !item.available && "cursor-not-allowed opacity-50",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {!item.available && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                )}
              </Link>
              {item.children && active && item.available && (
                <div className="ml-9 mt-1 space-y-1 border-l pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "block rounded-md px-2 py-1 text-sm transition-colors",
                        pathname === child.href
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        Local-first · Phase 1
      </div>
    </aside>
  );
}
