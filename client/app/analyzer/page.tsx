import type { Metadata } from "next";
import "../marketing.css";
import "../../styles/agentMarkdown.css";
import "../jrecommender/jobs.css";
import "./analyzer.css";
import { AnalyzerWorkspace } from "./AnalyzerWorkspace";

export const metadata: Metadata = {
  title: "Resume Analyzer",
  description:
    "Upload your resume PDF, paste a job description, and get AI feedback on fit and next steps.",
};

export default function AnalyzerPage() {
  return (
    <div className="mkt analyzer">
      <header className="analyzer-hero">
        <div className="analyzer-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell analyzer-hero-inner">
          <p className="analyzer-brand mkt-rise">JobGenius</p>
          <h1 className="analyzer-headline mkt-rise mkt-rise-delay">
            Resume on the left. Role on the right.
          </h1>
          <p className="analyzer-support mkt-rise mkt-rise-delay-2">
            Upload your PDF, paste the job description and your must-haves —
            then see how the story lines up. Stay on this page while we analyze.
          </p>
        </div>
      </header>

      <section className="analyzer-stage" aria-label="Analyzer workspace">
        <div className="mkt-shell analyzer-stage-inner">
          <AnalyzerWorkspace />
        </div>
      </section>
    </div>
  );
}
