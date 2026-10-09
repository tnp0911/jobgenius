"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  freeAnalyzeResume,
  premiumAnalyzeResumeRequest,
  type FreeAnalyzeResult,
} from "@/services/resumeService";
import { ResumeDropzone } from "./ResumeDropzone";
import { JobBriefPanel } from "./JobBriefPanel";
import { AnalyzerLoading } from "./AnalyzerLoading";
import { AnalyzerResults } from "./AnalyzerResults";
import { useAuth } from "@/contexts/AuthContext";
import { AuthOptions } from "@/auth/types";
import { isAborted } from "@/utils/errorHelpers";

type Phase = "idle" | "loading" | "done";

export function AnalyzerWorkspace() {
  const router = useRouter();
  const { status, tier } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [includesJobFinder, setIncludesJobFinder] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<FreeAnalyzeResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  async function onAnalyze() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!file) {
      toast.error("Upload a PDF resume first.");
      return;
    }

    setPhase("loading");
    setResult(null);

    try {
      const options: AuthOptions = {
        signal: controller.signal,
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 180_000,
      };

      if (tier?.toLowerCase() !== "premium") {
        const data = await freeAnalyzeResume(
          file,
          jobDescription.trim(),
          requirements.trim(),
          options,
        );
        if (controller.signal.aborted || controllerRef.current !== controller) return;
        if (!data) {
          setPhase("idle");
          return;
        }
        setResult(data);
        setPhase("done");
        return;
      }

      const data = await premiumAnalyzeResumeRequest(
        file,
        jobDescription.trim(),
        requirements.trim(),
        includesJobFinder,
        options,
      );
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      if (!data?.job_id) {
        setPhase("idle");
        if (data && !data.job_id) {
          toast.error("Failed to start analysis. Please try again later.");
        }
        return;
      }

      if (data.message) {
        toast.warning(data.message);
      }

      if (typeof window !== "undefined" && file.name) {
        sessionStorage.setItem(`analyzer_file_${data.job_id}`, file.name);
      }

      router.push(`/analyzer/waiting/${data.job_id}`);
    } catch (error) {
      if (isAborted(error)) return;
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const message =
        error instanceof Error ? error.message : "Analysis failed. Please try again.";
      toast.error(message);
      setPhase("idle");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  function onAnalyzeAgain() {
    setPhase("idle");
    setResult(null);
  }

  const canAnalyze = Boolean(file) && phase !== "loading";

  if (phase === "loading") {
    return <AnalyzerLoading fileName={file?.name} />;
  }

  if (phase === "done" && result) {
    return <AnalyzerResults result={result} onAnalyzeAgain={onAnalyzeAgain} />;
  }

  return (
    <div className="analyzer-workspace">
      <div className="analyzer-split" aria-label="Resume and job brief">
        <section className="analyzer-pane analyzer-pane-upload" aria-labelledby="analyzer-upload-title">
          <div className="analyzer-pane-head">
            <p className="analyzer-pane-kicker">01 · Resume</p>
            <h2 id="analyzer-upload-title" className="analyzer-pane-title">
              Your PDF
            </h2>
            <p className="analyzer-pane-lead">
              Drop the resume you want read — structure, skills, and gaps.
            </p>
          </div>
          <ResumeDropzone showActions={false} onFileChange={setFile} />
        </section>

        <div className="analyzer-split-rule" aria-hidden="true">
          <span>meets</span>
        </div>

        <section className="analyzer-pane analyzer-pane-brief" aria-labelledby="analyzer-brief-title">
          <div className="analyzer-pane-head">
            <p className="analyzer-pane-kicker">02 · Role</p>
            <h2 id="analyzer-brief-title" className="analyzer-pane-title">
              Job brief
            </h2>
            <p className="analyzer-pane-lead">
              Paste the posting and must-haves so we can score fit, not just polish.
            </p>
          </div>
          <JobBriefPanel
            jobDescription={jobDescription}
            requirements={requirements}
            includesJobFinder={includesJobFinder}
            onJobDescriptionChange={setJobDescription}
            onRequirementsChange={setRequirements}
            onIncludesJobFinderChange={setIncludesJobFinder}
            isPremium={
              status === "authenticated" && tier?.toLowerCase() === "premium"
            }
          />
        </section>
      </div>

      <div className="analyzer-workspace-footer">
        <p className="analyzer-workspace-note">
          {file
            ? `Ready with “${file.name}”${jobDescription.trim() || requirements.trim() ? " and a role brief" : ""}.`
            : "Upload a resume to unlock analysis. Role fields are optional but recommended."}
        </p>
        <button
          type="button"
          className="mkt-btn mkt-btn-primary analyzer-analyze"
          disabled={!canAnalyze}
          onClick={() => {
            void onAnalyze();
          }}
        >
          Analyze fit
        </button>
      </div>
    </div>
  );
}
