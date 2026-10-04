"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  premiumAnalyzeResumeSSE,
} from "@/services/resumeService";
import { AnalyzerLoading } from "../../AnalyzerLoading";

const FILE_STORAGE_PREFIX = "analyzer_file_";

export function WaitingWorkspace() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Connecting to analysis progress…");
  const [fileName, setFileName] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const storedName = sessionStorage.getItem(`${FILE_STORAGE_PREFIX}${jobId}`);
    if (storedName) setFileName(storedName);

    const es = premiumAnalyzeResumeSSE(jobId, {
      onProgress: (event) => {
        if (typeof event.progress === "number") {
          setProgress(event.progress);
        }
        const status = String(event.status ?? "").toUpperCase();
        if (status === "PENDING" || status === "QUEUED") {
          setStatusText("Queued — waiting for a worker…");
        } else if (status === "RUNNING" || status === "IN_PROGRESS") {
          setStatusText("Running premium analysis pipeline…");
        } else if (status) {
          setStatusText(`Status: ${event.status}`);
        }
      },
      onComplete: (event) => {
        if (event.status !== "COMPLETED") {
          setFailed(true);
          toast.error("Analysis failed. Please try again.");
          return;
        }
        setProgress(100);
        setStatusText("Analysis complete — opening results…");
        router.push(`/analyzer/result/${jobId}`);
      },
      onError: () => {
        setFailed(true);
      },
    });

    return () => {
      es.close();
    };
  }, [jobId, router]);

  if (!jobId) {
    return (
      <div className="analyzer-status" role="alert">
        Missing analysis job id.
      </div>
    );
  }

  if (failed) {
    return (
      <section className="analyzer-status" role="alert">
        <p className="analyzer-pane-kicker">Premium analysis</p>
        <h2 className="analyzer-pane-title">Something went wrong</h2>
        <p className="analyzer-pane-lead">
          We could not finish streaming progress for this run. Start a new
          analysis from the analyzer page.
        </p>
        <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
          Back to analyzer
        </Link>
      </section>
    );
  }

  return (
    <AnalyzerLoading
      fileName={fileName}
      progress={progress}
      statusText={statusText}
    />
  );
}
