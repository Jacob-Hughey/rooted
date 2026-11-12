import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { Droplet, House, Leaf, SlidersHorizontal } from "lucide-react";
import { SyncStatus } from "@/components/SyncStatus";
import { ToastProvider } from "@/components/Toast";
import { useLiveSync } from "@/data/live";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Today", icon: Droplet, end: true },
  { to: "/plants", label: "Plants", icon: Leaf },
  { to: "/rooms", label: "Rooms", icon: House },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
];

/**
 * Phone: bottom tab bar (thumb reach).  iPad / wide screens: side rail.
 */
export function AppShell() {
  useLiveSync();
  return (
    <ToastProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[96px_1fr]">
        <nav
          aria-label="Main"
          className={cn(
            "fixed inset-x-0 bottom-0 z-20 border-t bg-card pb-safe",
            "md:sticky md:top-0 md:h-dvh md:border-r md:border-t-0 md:pt-safe",
          )}
        >
          <SyncStatus />
          <ul className="mx-auto grid max-w-md grid-cols-4 md:flex md:flex-col md:items-center md:gap-3 md:pt-8">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 px-3 pb-1 pt-2 text-xs",
                      isActive ? "font-bold text-foreground" : "text-muted-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn("size-6", isActive && "text-water")}
                        strokeWidth={isActive ? 2 : 1.6}
                        fill={isActive ? "currentColor" : "none"}
                        fillOpacity={isActive ? 0.18 : 0}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="mx-auto w-full max-w-3xl px-5 pb-32 pt-safe md:px-10 md:pb-12">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-6 pt-6">
      <div className="space-y-1">
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        <h1 className="text-[2.5rem]">{title}</h1>
      </div>
      {action}
    </header>
  );
}
