import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import ProfileDialog from "@/components/ProfileDialog";
import { cn } from "@/lib/utils";

export type ShellNavItem = {
  name: string;
  icon: ComponentType<{ className?: string }>;
};

type Props = {
  /** Zichtbare navigatie-items voor de huidige rol/viewport. */
  navItems: ShellNavItem[];
  /** Actief tab-label. */
  currentTab: string;
  /** Callback wanneer de gebruiker een ander tabblad kiest. */
  onTabChange: (name: string) => void;
  /** Kop voor de topbalk — default: currentTab. */
  pageTitle?: string;
  /** Getoonde naam in de user-card onderaan de sidebar. */
  userName: string;
  /** Rol-label ("Bakker", "Klant", …). */
  roleLabel: string;
  /** Supabase-user (voor ProfileDialog). */
  user: User | null;
  /** Callback wanneer profiel wordt aangepast. */
  onProfileUpdate: (newName: string) => void;
  /** Logout-handler. */
  onLogout: () => void;
  /** Inhoud van het gekozen tabblad. */
  children: ReactNode;
};

/**
 * Gedeelde Japandi-shell voor Dashboard en CustomerDashboard.
 * - Rustige sidebar met serif-logo, ruime padding en sobere hover.
 * - Topbalk heeft een serif-paginatitel en datumrechts.
 * - Mobile: drawer met volle hoogte, backdrop met zachte blur.
 */
export default function DashboardShell({
  navItems,
  currentTab,
  onTabChange,
  pageTitle,
  userName,
  roleLabel,
  user,
  onProfileUpdate,
  onLogout,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mobiele drawer automatisch sluiten bij resize naar desktop, en scroll-lock terwijl open.
  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const title = pageTitle ?? currentTab;
  const today = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full w-[260px] flex-col border-r border-border/70 bg-sidebar",
          "transform transition-transform duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="bakery-eyebrow mb-1.5">Bakkerij</p>
              <h1
                className="font-serif text-[1.875rem] font-medium text-foreground leading-none"
                style={{ letterSpacing: "-0.02em" }}
              >
                Bosgoedt
              </h1>
            </div>
            <button
              className="lg:hidden -mr-1.5 p-2 rounded-[calc(var(--radius)-4px)] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Sluit navigatie"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-5 h-px w-10 bg-border" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scroll-soft px-4 pt-2 pb-4">
          <p className="px-3 pb-3 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Menu
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = currentTab === item.name;
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <button
                    onClick={() => {
                      onTabChange(item.name);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-muted/70 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {/* Active-marker */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full transition-opacity",
                        isActive ? "bg-foreground opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User card */}
        <div className="border-t border-border/60 p-4">
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border/60 bg-card/70 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[0.8125rem] font-medium text-foreground">
              {(userName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{userName}</p>
              <p className="truncate text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                {roleLabel}
              </p>
            </div>
            <ProfileDialog user={user} onProfileUpdate={onProfileUpdate} />
            <button
              onClick={onLogout}
              className="rounded-[calc(var(--radius)-4px)] p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive"
              title="Uitloggen"
              aria-label="Uitloggen"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between gap-4 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-sm sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden shrink-0 rounded-[calc(var(--radius)-4px)] p-2 text-foreground transition-colors hover:bg-muted/60"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigatie"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2
              className="truncate font-serif text-xl font-medium text-foreground sm:text-[1.5rem]"
              style={{ letterSpacing: "-0.015em" }}
            >
              {title}
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span className="h-px w-8 bg-border/80" />
            <span className="text-xs text-muted-foreground tracking-[0.08em]">{today}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
