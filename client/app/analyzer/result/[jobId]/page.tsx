import type { Metadata } from "next";
import "../../../marketing.css";
import "../../analyzer.css";
import { ResultWorkspace } from "./ResultWorkspace";

export const metadata: Metadata = {
  title: "Analysis results",
  description: "Your JobGenius premium resume analysis results.",
};

export default function AnalyzerResultPage() {
  return (
    <div className="mkt analyzer">
      <header className="analyzer-hero">
        <div className="analyzer-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell analyzer-hero-inner">
          <p className="analyzer-brand mkt-rise">JobGenius</p>
          <h1 className="analyzer-headline mkt-rise mkt-rise-delay">
            Your fit notes are ready.
          </h1>
          <p className="analyzer-support mkt-rise mkt-rise-delay-2">
            Review scores, gaps, and suggestions from your premium analysis run.
          </p>
        </div>
      </header>

      <section className="analyzer-stage" aria-label="Analysis results">
        <div className="mkt-shell analyzer-stage-inner">
          <ResultWorkspace />
        </div>
      </section>
    </div>
  );
}
