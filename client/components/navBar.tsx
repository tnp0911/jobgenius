"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { handleLogout } from "@/auth/api";
import { clearAuthSession, useAuth } from "@/contexts/AuthContext";
import "./navBar.css";
import { toast } from "react-toastify";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "R-Analyzer", href: "/analyzer" },
  { label: "J-Recommender", href: "/jrecommender" },
  { label: "Plans", href: "/plans" },
  { label: "About", href: "/about" },
  { label: "FAQs", href: "/faqs" },
  { label: "Contact", href: "/contact" },
] as const;

const PROFILE_LINKS = [
  { label: "My Account", href: "/myaccount" },
  { label: "Settings & Privacy", href: "/settings_privacy" },
  { label: "Billing & Subscription", href: "/billing_subscription" }
] as const;

function ProfileIcon() {
  return (
    <svg
      className="profile-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-3.5 4.5-5.5 7-5.5s5.5 2 7 5.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="navbar-menu-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      ) : (
        <>
          <path d="M4 7h16" strokeLinecap="round" />
          <path d="M4 12h16" strokeLinecap="round" />
          <path d="M4 17h16" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function AuthActionSkeleton() {
  return (
    <div
      className="navbar-auth-skeleton"
      aria-hidden="true"
      aria-busy="true"
    />
  );
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, tier, refreshAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("navbar-menu-lock");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("navbar-menu-lock");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!profileOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && !profileMenuRef.current?.contains(target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [profileOpen]);

  const onLogout = async () => {
    try {
      await handleLogout();
      toast.success("Logged out successfully");
    } catch {
      /* still clear local session state */
    } finally {
      clearAuthSession();
      await refreshAuth();
      router.push("/");
      router.refresh();
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderPlanBanner = () => {
    if (status !== "authenticated") return null;

    return tier?.toLowerCase() === "free" ? (
      <button
        type="button"
        className="plan-banner is-free"
        onClick={() => router.push("/plans")}
      >
        Upgrade ★
      </button>
    ) : (
      <p className="plan-banner is-premium">{tier}</p>
    );
  };

  const renderAuthAction = () => {
    if (status === "loading") {
      return <AuthActionSkeleton />;
    }

    if (status === "authenticated") {
      return (
        <div
          className={`profile-menu${profileOpen ? " is-open" : ""}`}
          ref={profileMenuRef}
        >
          <button
            type="button"
            className="profile-trigger"
            aria-label="Account menu"
            aria-haspopup="true"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <ProfileIcon />
          </button>
          <div className="profile-dropdown" role="menu">
            {PROFILE_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="profile-dropdown-item"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              className="profile-dropdown-item logout"
              role="menuitem"
              onClick={onLogout}
            >
              Logout
            </button>
            <div
              className="site-version"
            >
              <p>v1.1.0-beta</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Link href="/login" className="navbar-login-btn">
        Log in
      </Link>
    );
  };

  return (
    <header className={`navbar${menuOpen ? " is-menu-open" : ""}`}>
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          JobGenius
        </Link>

        <nav className="navbar-center" aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-link${isActive(href) ? " is-active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="navbar-end">
          {renderPlanBanner()}
          <div className="navbar-actions">{renderAuthAction()}</div>
          <button
            type="button"
            className="navbar-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      <div
        id={menuId}
        className={`navbar-drawer${menuOpen ? " is-open" : ""}`}
        hidden={!menuOpen}
      >
        <nav className="navbar-drawer-nav" aria-label="Mobile navigation">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-drawer-link${isActive(href) ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {menuOpen ? (
        <button
          type="button"
          className="navbar-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
    </header>
  );
}
