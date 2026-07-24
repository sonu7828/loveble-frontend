import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MapPin, Phone, Menu, X, Mail, UserCheck, Instagram, Facebook, Globe, Navigation } from "lucide-react";
import rkaLogo from "@/assets/rka-logo.webp";
import ThemeToggle from "@/components/ThemeToggle";
import NewsletterSignup from "@/components/NewsletterSignup";

export const SiteHeader = ({ isPortal = false }: { isPortal?: boolean }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const skipToMain: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: false });
    main.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <>
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between py-3 gap-3">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 leading-tight min-w-0 md:mr-auto group">
            <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-cover shadow-soft shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-serif text-base sm:text-xl font-medium tracking-tight truncate">
                Radiantilyk Aesthetic
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground tracking-wider uppercase">
                <span className="font-semibold text-primary">MEDSPA</span>
                <span className="opacity-40">•</span>
                <span className="hidden sm:flex items-center gap-1 font-normal normal-case text-[11px] text-muted-foreground truncate">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  San Jose · 2100 Curtner Ave, Ste 1B
                </span>
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {!isPortal && (
              <>
                <NavLink to="/" end className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition"}>Home</NavLink>
                <NavLink to="/services" className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition"}>Services & Pricing</NavLink>
                <NavLink to="/model" className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition"}>Model Application</NavLink>
                <NavLink to="/account/auth" className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition"}>My Account</NavLink>
              </>
            )}
            <ThemeToggle />
            <NavLink to="/book" className="rounded-full bg-primary px-5 py-2 text-primary-foreground hover:opacity-90 transition shadow-soft">Book Appointment</NavLink>
          </nav>
          <div className="md:hidden flex items-center gap-2 shrink-0">
            <Link to="/book" className="rounded-full bg-primary px-3.5 py-2 text-sm text-primary-foreground">Book</Link>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="relative z-50 inline-flex items-center justify-center h-12 w-12 -mr-2 rounded-full border border-border bg-background text-foreground active:scale-95 touch-manipulation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>


        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-4 py-3 flex flex-col text-sm">
              {!isPortal && (
                <>
                  <NavLink to="/services" className="py-3 border-b border-border">Services & Pricing</NavLink>
                  <NavLink to="/account/auth" className="py-3 border-b border-border">My Account</NavLink>
                  <NavLink to="/model" className="py-3 border-b border-border">Become a Model</NavLink>
                  <NavLink to="/faq" className="py-3 border-b border-border">FAQ</NavLink>
                </>
              )}
              <NavLink to="/book" className="py-3 border-b border-border">Book Appointment</NavLink>

              <a href="tel:4083511873" className="py-3 flex items-center gap-2 text-muted-foreground border-b border-border"><Phone className="h-3.5 w-3.5" /> Call 408 · 351 · 1873</a>
              <a href="sms:+14083511873" className="py-3 flex items-center gap-2 text-muted-foreground border-b border-border">💬 Text us</a>
              <div className="py-3 flex items-center justify-between">
                <span className="text-muted-foreground">Appearance</span>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
};

export const SiteFooter = () => (
  <footer className="border-t border-border bg-background text-foreground pt-16 pb-8 transition-colors duration-300">
    <div className="container mx-auto px-6 md:px-10 grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-xs">
      {/* Column 1: Brand Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-10 w-10 rounded-full object-cover border border-border" />
          <div>
            <div className="font-serif text-lg font-medium text-foreground">Radiantilyk Aesthetic</div>
            <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">MEDSPA</div>
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-muted-foreground text-[11px] leading-relaxed">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>2100 Curtner Ave, Ste 18, San Jose, CA 95124</span>
        </p>
        <p className="text-muted-foreground text-[11px] leading-relaxed italic">
          A quiet ritual of refinement. Luxury medspa in San Jose.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="p-2 rounded-full border border-border bg-card hover:bg-primary hover:text-primary-foreground transition text-primary">
            <Instagram className="h-3.5 w-3.5" />
          </a>
          <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="p-2 rounded-full border border-border bg-card hover:bg-primary hover:text-primary-foreground transition text-primary">
            <Facebook className="h-3.5 w-3.5" />
          </a>
          <a href="https://g.page/r/CSd3Q5ZmyEyKEBM/review" target="_blank" rel="noreferrer" aria-label="Google Reviews" className="p-2 rounded-full border border-border bg-card hover:bg-primary hover:text-primary-foreground transition text-primary">
            <Globe className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Column 2: Studio Location */}
      <div className="space-y-3">
        <div className="font-serif text-sm font-semibold text-foreground uppercase tracking-wider">San Jose Studio</div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          2100 Curtner Ave, Ste 18<br />
          San Jose, CA 95124
        </p>
        <a
          href="https://maps.google.com/?q=2100+Curtner+Ave+Ste+18+San+Jose+CA+95124"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-accent text-secondary-foreground font-medium text-[11px] transition shadow-xs"
        >
          <Navigation className="h-3 w-3 text-primary" />
          Get Directions
        </a>
      </div>

      {/* Column 3: Contact */}
      <div className="space-y-2.5">
        <div className="font-serif text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Contact</div>
        <a href="tel:4083511873" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-[11px]">
          <Phone className="h-3.5 w-3.5 text-primary" />
          Call 408 · 351 · 1873
        </a>
        <a href="sms:+14083511873" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-[11px]">
          <Mail className="h-3.5 w-3.5 text-primary" />
          Text us (408 · 351 · 1873)
        </a>
        <a href="mailto:kv@rkaglow.com" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-[11px]">
          <Mail className="h-3.5 w-3.5 text-primary" />
          kv@rkaglow.com
        </a>
        <Link to="/waitlist" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-[11px] pt-1">
          <UserCheck className="h-3.5 w-3.5 text-primary" />
          Join the waitlist
        </Link>
        <Link to="/staff" className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground pt-2 inline-block">
          Staff Login →
        </Link>
      </div>

      {/* Column 4: Hours */}
      <div className="space-y-3">
        <div className="font-serif text-sm font-semibold text-foreground uppercase tracking-wider">Hours</div>
        <div className="space-y-1.5 text-muted-foreground text-[11px]">
          <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
            <span>Mon — Fri</span>
            <span className="font-medium text-foreground">9:00 AM — 5:00 PM</span>
          </div>
          <div className="flex justify-between gap-2 border-b border-border/60 pb-1">
            <span>Sat</span>
            <span className="font-medium text-foreground">9:00 AM — 2:00 PM</span>
          </div>
          <div className="flex justify-between gap-2 pb-1">
            <span>Sun</span>
            <span className="text-primary font-medium">Closed</span>
          </div>
        </div>
      </div>
    </div>

    {/* Newsletter Container */}
    <div className="container mx-auto px-6 mt-12 pb-8">
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur p-6 md:p-8 max-w-3xl mx-auto shadow-sm">
        <NewsletterSignup />
      </div>
    </div>

    {/* Footer Bottom Bar */}
    <div className="border-t border-border pt-6 pb-2 text-center text-[11px] text-muted-foreground flex flex-wrap items-center justify-center gap-2 sm:gap-4 px-4">
      <span>© {new Date().getFullYear()} Radiantilyk Aesthetic</span>
      <span>·</span>
      <Link to="/faq" className="hover:text-foreground">FAQ</Link>
      <span>·</span>
      <Link to="/journal" className="hover:text-foreground">Journal</Link>
      <span>·</span>
      <Link to="/account?tab=profile" className="hover:text-foreground">Refer & earn</Link>
      <span>·</span>
      <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
      <span>·</span>
      <Link to="/terms" className="hover:text-foreground">Terms</Link>
    </div>
  </footer>
);
