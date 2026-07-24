import { NavLink } from "react-router-dom";
import { Sun, Calendar as CalIcon, UserCircle2, CreditCard, Stethoscope } from "lucide-react";

type Item = { to: string; label: string; icon: any; show: boolean; badge?: number };

/**
 * Persistent bottom nav for tablet & mobile (<lg).
 * Surfaces the 5 most-used staff routes without opening the hamburger.
 */
export function StaffBottomNav({
  canCheckout,
  canClinical,
  pendingBadge = 0,
}: {
  canCheckout: boolean;
  canClinical: boolean;
  pendingBadge?: number;
}) {
  const items: Item[] = [
    { to: "/staff/today", label: "Today", icon: Sun, show: true, badge: pendingBadge },
    { to: "/staff/calendar", label: "Calendar", icon: CalIcon, show: true },
    { to: "/staff/clients", label: "Clients", icon: UserCircle2, show: true },
    { to: "/staff/checkout", label: "Checkout", icon: CreditCard, show: canCheckout },
    { to: "/staff/clinical", label: "Clinical", icon: Stethoscope, show: canClinical },
  ].filter(i => i.show);

  return (
    <nav
      className="xl:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary navigation"
    >
      <ul className="grid grid-cols-5">
        {items.map(i => {
          const Icon = i.icon;
          return (
            <li key={i.to}>
              <NavLink
                to={i.to}
                end={i.to === "/staff/clinical"}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-wider transition ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{i.label}</span>
                {i.badge && i.badge > 0 ? (
                  <span className="absolute top-1 right-1/2 translate-x-3 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                    {i.badge > 9 ? "9+" : i.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
