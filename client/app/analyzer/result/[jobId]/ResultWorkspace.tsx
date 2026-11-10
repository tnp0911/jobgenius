"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PremiumAnalyzeResult } from "@/services/resumeService";
import { premiumAnalyzeResumeResult } from "@/services/resumeService";
import { AnalyzerResults } from "../../AnalyzerResults";

export function ResultWorkspace() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;
  const [result, setResult] = useState<PremiumAnalyzeResult | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setMissing(true);
      return;
    }
    const fetchResult = async () => {
      try {
        const next = await premiumAnalyzeResumeResult(jobId);
        if (!next) {
          setMissing(true);
          return;
        }
        setResult(next);
      } catch {
        setMissing(true);
      }
    };
    fetchResult();
  }, [jobId]);

  if (missing) {
    return (
      <section className="analyzer-status" role="alert">
        <p className="analyzer-pane-kicker">Results</p>
        <h2 className="analyzer-pane-title">Results unavailable</h2>
        <p className="analyzer-pane-lead">
          This analysis result was not found or has expired. Temporary results
          are kept for 24 hours. Run the analyzer again to generate a new report.
        </p>
        <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
          Back to analyzer
        </Link>
      </section>
    );
  }

  if (!result) {
    return (
      <div className="analyzer-status" aria-busy="true">
        Loading results…
      </div>
    );
  }

  return (
    <AnalyzerResults
      result={result}
      jobId={jobId}
      onAnalyzeAgain={() => {
        router.replace("/analyzer");
      }}
    />
  );
}
