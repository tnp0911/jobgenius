import { toast } from "react-toastify";
import { getPendingResumeAnalyses } from "@/services/resumeService";

const SESSION_FLAG = "pending_analysis_toast_shown";

/**
 * After login, nudge the user once per browser session if they still have a
 * completed analysis waiting for accept/reject (Redis TTL: 24 hours).
 */
export async function notifyPendingAnalysisAfterLogin(): Promise<void> {
  try {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG) === "1") {
      return;
    }
  } catch {
    // private mode / quota — still attempt the toast
  }

  const pending = await getPendingResumeAnalyses();
  if (!pending || pending.length === 0) return;

  const first = pending[0];
  const label = first.resume_filename?.trim() || "your resume";
  const href = `/analyzer/result/${encodeURIComponent(first.job_id)}`;
  const extra =
    pending.length > 1
      ? ` You have ${pending.length} pending analyses — open My Account for all links.`
      : "";

  toast.info(
    `You still have an optimized resume waiting for “${label}”. Review it within 24 hours.${extra}`,
    {
      autoClose: 10_000,
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.assign(href);
        }
      },
    },
  );

  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
    // ignore
  }
}
