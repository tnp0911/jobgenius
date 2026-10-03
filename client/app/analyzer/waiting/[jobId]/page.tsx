import type { Metadata } from "next";
import "../../../marketing.css";
import "../../analyzer.css";
import { WaitingWorkspace } from "./WaitingWorkspace";

export const metadata: Metadata = {
  title: "Analyzing resume",
  description: "Premium resume analysis in progress.",
};

export default function AnalyzerWaitingPage() {
  return (
    <div className="mkt analyzer">
      <header className="analyzer-hero">
        <div className="analyzer-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell analyzer-hero-inner">
          <p className="analyzer-brand mkt-rise">JobGenius</p>
          <h1 className="analyzer-headline mkt-rise mkt-rise-delay">
            Premium analysis running.
          </h1>
          <p className="analyzer-support mkt-rise mkt-rise-delay-2">
            Stay on this page while we stream progress from the analysis pipeline.
          </p>
        </div>
      </header>

      <section className="analyzer-stage" aria-label="Analysis progress">
        <div className="mkt-shell analyzer-stage-inner">
          <WaitingWorkspace />
        </div>
      </section>
    </div>
  );
}
