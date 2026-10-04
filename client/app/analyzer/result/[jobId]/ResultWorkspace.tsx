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
        const result = await premiumAnalyzeResumeResult(jobId);
        setResult(result);
      } catch (error) {
        setMissing(true);
      }
    };
    fetchResult();
  }, [jobId, setMissing, setResult]);

  if (missing) {
    return (
      <section className="analyzer-status" role="alert">
        <p className="analyzer-pane-kicker">Results</p>
        <h2 className="analyzer-pane-title">Results unavailable</h2>
        <p className="analyzer-pane-lead">
          We could not find the finished analysis in this browser session.
          Run the analyzer again to generate a new report.
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
      onAnalyzeAgain={() => {
        router.replace("/analyzer");
      }}
    />
  );
}
