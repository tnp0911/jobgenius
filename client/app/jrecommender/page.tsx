import type { Metadata } from "next";
import "../marketing.css";
import "../../styles/agentMarkdown.css";
import "./jobs.css";
import { JobRecommenderWorkspace } from "./JobRecommenderWorkspace";

export const metadata: Metadata = {
  title: "Job Recommender",
  description:
    "Browse nearby roles or upload your resume with a prompt to get AI-matched job recommendations.",
};

export default function JobRecommenderPage() {
  return (
    <div className="mkt jobs">
      <header className="jobs-hero">
        <div className="jobs-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell jobs-hero-inner">
          <p className="jobs-brand mkt-rise">JobGenius</p>
          <h1 className="jobs-headline mkt-rise mkt-rise-delay">
            Roles that fit how you work.
          </h1>
          <p className="jobs-support mkt-rise mkt-rise-delay-2">
            Guests see openings nearby. Signed-in members can refine by role — or upload a
            resume and prompt for matches built from your story.
          </p>
        </div>
      </header>

      <section className="jobs-stage" aria-label="Job recommendations">
        <div className="mkt-shell jobs-stage-inner">
          <JobRecommenderWorkspace />
        </div>
      </section>
    </div>
  );
}
