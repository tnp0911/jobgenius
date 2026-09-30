"use client";

import { handleAnonymousReady } from "@/auth/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useEffect } from "react";
import "./home.css";
import "./marketing.css";

function HeroVisual() {
  return (
    <svg
      className="home-hero-visual"
      viewBox="0 0 640 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="hg-panel"
          x1="80"
          y1="40"
          x2="560"
          y2="480"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="1" stopColor="#eff6ff" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient
          id="hg-line"
          x1="120"
          y1="420"
          x2="520"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      <rect
        x="72"
        y="48"
        width="420"
        height="400"
        rx="28"
        fill="url(#hg-panel)"
        stroke="rgba(148,163,184,0.35)"
      />
      <rect
        x="108"
        y="92"
        width="180"
        height="18"
        rx="9"
        fill="#2563eb"
        opacity="0.9"
      />
      <rect
        x="108"
        y="128"
        width="280"
        height="12"
        rx="6"
        fill="#94a3b8"
        opacity="0.45"
      />
      <rect
        x="108"
        y="152"
        width="240"
        height="12"
        rx="6"
        fill="#94a3b8"
        opacity="0.35"
      />
      <rect x="108" y="200" width="300" height="10" rx="5" fill="#cbd5e1" />
      <rect x="108" y="226" width="260" height="10" rx="5" fill="#cbd5e1" />
      <rect x="108" y="252" width="290" height="10" rx="5" fill="#cbd5e1" />
      <rect x="108" y="300" width="120" height="36" rx="10" fill="#dbeafe" />
      <rect x="244" y="300" width="120" height="36" rx="10" fill="#dbeafe" />

      <path
        className="home-hero-path"
        d="M150 430 C 220 430, 240 360, 300 300 S 400 180, 470 150"
        stroke="url(#hg-line)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        className="home-hero-dot"
        cx="470"
        cy="150"
        r="14"
        fill="#2563eb"
      />
      <circle cx="470" cy="150" r="6" fill="#ffffff" />

      <g className="home-hero-float">
        <rect
          x="430"
          y="250"
          width="160"
          height="120"
          rx="20"
          fill="#ffffff"
          stroke="rgba(37,99,235,0.25)"
        />
        <rect x="454" y="278" width="88" height="10" rx="5" fill="#2563eb" />
        <rect
          x="454"
          y="302"
          width="112"
          height="8"
          rx="4"
          fill="#94a3b8"
          opacity="0.5"
        />
        <rect
          x="454"
          y="322"
          width="96"
          height="8"
          rx="4"
          fill="#94a3b8"
          opacity="0.35"
        />
      </g>
    </svg>
  );
}

export default function Home() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      handleAnonymousReady();
    }
  }, [status]);

  return (
    <div className="mkt home">
      <section className="home-hero" aria-labelledby="home-brand">
        <div className="home-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell home-hero-grid">
          <div className="home-hero-copy">
            <p id="home-brand" className="home-brand mkt-rise">
              JobGenius
            </p>
            <h1 className="home-headline mkt-rise mkt-rise-delay">
              Career clarity, powered by AI
            </h1>
            <p className="home-support mkt-rise mkt-rise-delay-2">
              See what your resume signals, match roles that fit, and move
              forward without the guesswork.
            </p>
            <div className="mkt-cta-row mkt-rise mkt-rise-delay-2">
              {status === "unauthenticated" ? (
                <Link href="/register" className="mkt-btn mkt-btn-primary">
                  Start free
                </Link>
              ) : (
                <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
                  Try R-Analyzer
                </Link>
              )}
              <Link href="/about" className="mkt-btn mkt-btn-ghost">
                Why JobGenius
              </Link>
            </div>
          </div>
          <div className="home-hero-media mkt-rise mkt-rise-delay">
            <HeroVisual />
          </div>
        </div>
      </section>

      <section
        className="mkt-section home-flow"
        aria-labelledby="home-flow-title"
      >
        <div className="mkt-shell">
          <p className="mkt-kicker">How it works</p>
          <h2 id="home-flow-title" className="mkt-title">
            Three moves. One clearer path.
          </h2>
          <ol className="home-steps">
            <li>
              <span className="home-step-num">01</span>
              <h3>Upload your resume</h3>
              <p>
                We read structure, skills, and gaps the way a sharp recruiter
                would.
              </p>
            </li>
            <li>
              <span className="home-step-num">02</span>
              <h3>Get honest feedback</h3>
              <p>
                Strengths, blind spots, and rewrites that make your story land.
              </p>
            </li>
            <li>
              <span className="home-step-num">03</span>
              <h3>Match real roles</h3>
              <p>
                Surface jobs aligned with your experience — not endless noise.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section
        className="mkt-section home-promise"
        aria-labelledby="home-promise-title"
      >
        <div className="mkt-shell home-promise-grid">
          <div>
            <p className="mkt-kicker">Built for seekers</p>
            <h2 id="home-promise-title" className="mkt-title">
              Less scrolling. More signal.
            </h2>
            <p className="mkt-lead">
              JobGenius is for people who are serious about their next role —
              whether you are polishing a resume, switching fields, or hunting
              with purpose.
            </p>
          </div>
          <ul className="home-promise-list">
            <li>AI resume analysis with actionable notes</li>
            <li>Role matching tuned to your profile</li>
            <li>A calm workspace for a noisy job market</li>
          </ul>
        </div>
      </section>

      <section className="home-bottom-cta" aria-labelledby="home-bottom-title">
        <div className="mkt-shell">
          <h2 id="home-bottom-title">Ready when you are.</h2>
          <p>{status === "unauthenticated" ? "Create a free account and take the first clear step today." : "Take the first clear step today."}</p>
          <div className="mkt-cta-row">
            {status === "unauthenticated" ? (
              <Link href="/register" className="mkt-btn mkt-btn-primary">
                Create account
              </Link>
            ) : (
              <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
                Try R-Analyzer
              </Link>
            )}
            <Link href="/faqs" className="mkt-btn mkt-btn-ghost">
              Read FAQs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
