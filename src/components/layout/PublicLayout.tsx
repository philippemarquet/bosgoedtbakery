import { Link, useLocation } from "react-router-dom";
import { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  const { pathname } = useLocation();
  const navLinkCls = (active: boolean) =>
    `text-sm tracking-[0.06em] uppercase transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/bestellen" className="font-serif text-2xl leading-none" style={{ letterSpacing: "-0.02em" }}>
            Bosgoedt <span className="text-muted-foreground font-light">Bakery</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/bestellen" className={navLinkCls(pathname === "/bestellen")}>
              Bestellen
            </Link>
            <Link to="/over" className={navLinkCls(pathname === "/over")}>
              Over
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© Bosgoedt Bakery — Oud-Turnhout</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <a href="mailto:hallo@bosgoedt.be" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
