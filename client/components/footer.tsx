"use client";
import Link from "next/link";
import "./footer.css";
import { useAuth } from "@/contexts/AuthContext";

const PRODUCT_LINKS = [
  { label: "Resume Analyzer", href: "/resume-analyzer" },
  { label: "Jobs", href: "/jobs" },
  { label: "FAQs", href: "/faqs" },
] as const;

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Home", href: "/" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Log in", href: "/login" },
  { label: "Create account", href: "/register" },
] as const;

export function Footer() {
  const { status } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand-block">
          <Link href="/" className="site-footer-brand">
            JobGenius
          </Link>
          <p className="site-footer-tagline">
            AI that helps you read your resume the way recruiters do — then
            points you toward roles that fit.
          </p>
        </div>

        <div className="site-footer-cols">
          <div className="site-footer-col">
            <h3>Product</h3>
            <ul>
              {PRODUCT_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer-col">
            <h3>Company</h3>
            <ul>
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer-col">
            <h3>Account</h3>
            <ul>
              {status === "unauthenticated" ? ACCOUNT_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              )) : (
                <li key={"/myaccount"}>
                  <Link href={"/myaccount"}>My Account</Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>
          &copy; {year === 2026 ? "2026" : `2026–${year}`} JobGenius. All rights reserved.
        </p>
        <p className="site-footer-note">Built for job seekers who want signal, not noise.</p>
      </div>
    </footer>
  );
}
