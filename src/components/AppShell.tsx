import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { Home, Leaf, DoorOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/plants", label: "Plants", icon: Leaf },
  { to: "/rooms", label: "Rooms", icon: DoorOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

/**
 * Phone: bottom tab bar (thumb reach).  iPad / wide screens: side rail.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[88px_1fr]">
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t bg-background/85 pb-safe backdrop-blur-lg",
          "md:sticky md:top-0 md:h-dvh md:border-r md:border-t-0 md:pt-safe",
        )}
      >
        <ul className="mx-auto flex max-w-md justify-around md:flex-col md:items-center md:gap-2 md:pt-6">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex min-w-16 flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("rounded-full px-4 py-1 transition-colors", isActive && "bg-secondary")}>
                      <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-safe md:px-8 md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-4">
      <div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <h1 className="text-3xl md:text-4xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}
