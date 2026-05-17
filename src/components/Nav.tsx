import { Link, useLocation } from "@tanstack/react-router";
import { Eye } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/reader", label: "Eye Reader" },
  { to: "/lessons", label: "Lessons" },
  { to: "/about", label: "About" },
] as const;

export function Nav() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="relative h-7 w-7 rounded-full iris-ring shadow-glow" aria-hidden />
          <span className="font-display text-lg tracking-tight">
            Iris<span className="text-primary">Scope</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-2 rounded-md transition-colors ${
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="bg-primary/10 border-t border-primary/20 text-[11px] text-center py-1.5 px-4 text-primary flex items-center justify-center gap-2">
        <Eye className="h-3 w-3" />
        Educational tool — iridology is not validated medicine. Not a diagnosis.
      </div>
    </header>
  );
}
