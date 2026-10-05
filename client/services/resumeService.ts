import axios from "axios";
import { toast } from "react-toastify";
import { axiosErrorMessage } from "../utils/errorHelpers";
import { AuthOptions } from "@/auth/types";
import { authConfig } from "@/auth/api";

export type FreeAnalyzeResult = {
  intent: Record<string, unknown>;
  analyzer: Record<string, unknown>;
  ats: Record<string, unknown>;
  feedback: Record<string, unknown> | string;
};

export async function freeAnalyzeResume(
  resumePdf: File,
  jdText: string = "",
  userGoal: string = "",
  options?: AuthOptions,
): Promise<FreeAnalyzeResult | null> {
  try {
    const formData = new FormData();
    formData.append("resume_pdf", resumePdf);
    formData.append("jd_text", jdText);
    formData.append("user_goal", userGoal);

    const { data } = await axios.post<FreeAnalyzeResult>(
      `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resume/analyze`,
      formData,
      authConfig(options),
    );
    return data;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to analyze resume. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export type PremiumAnalyzeJobResponse = {
  job_id: string;
  message?: string;
  status: string;
  progress: number;
}

export type PremiumAnalyzeResult = {
  intent: Record<string, unknown>;
  analyzer: Record<string, unknown>;
  ats: Record<string, unknown>;
  optimizer: Record<string, unknown>;
  feedback: Record<string, unknown> | string;
  job_finder: Record<string, unknown> | unknown | null;
};

export async function premiumAnalyzeResumeRequest(
  resumePdf: File,
  jdText: string = "",
  userGoal: string = "",
  includesJobFinder: boolean = false,
  options?: AuthOptions,
): Promise<PremiumAnalyzeJobResponse | null> {
  try {
    const formData = new FormData();
    formData.append("resume_pdf", resumePdf);
    formData.append("jd_text", jdText);
    formData.append("user_goal", userGoal);
    formData.append("includes_job_finder", includesJobFinder.toString());

    const { data } = await axios.post<PremiumAnalyzeJobResponse>(
      `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resume/analyze/premium`,
      formData,
      authConfig(options),
    );
    return data;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to analyze resume. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export type PremiumAnalyzeProgressEvent = {
  job_id: string;
  status: string;
  progress: number;
  error?: string;
};

export type PremiumAnalyzeSSEHandlers = {
  onProgress?: (event: PremiumAnalyzeProgressEvent) => void;
  onComplete?: (event: PremiumAnalyzeProgressEvent) => void;
  onError?: (error: Error) => void;
};

/**
 * Subscribe to premium analyze progress SSE (`event: progress`).
 * Closes the stream on COMPLETED / FAILED. Caller should also close on unmount.
 */
export function premiumAnalyzeResumeSSE(
  jobId: string,
  handlers: PremiumAnalyzeSSEHandlers = {},
): EventSource {
  const es = new EventSource(
    `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resume/analyze/progress/${jobId}`,
    { withCredentials: true },
  );

  let settled = false;

  const settle = (fn?: () => void) => {
    if (settled) return;
    settled = true;
    fn?.();
    es.close();
  };

  es.addEventListener("progress", (raw) => {
    try {
      const data = JSON.parse(
        (raw as MessageEvent<string>).data,
      ) as PremiumAnalyzeProgressEvent;

      handlers.onProgress?.(data);

      const status = String(data.status ?? "").toUpperCase();
      if (status === "COMPLETED") {
        settle(() => handlers.onComplete?.(data));
        return;
      }
      if (status === "FAILED") {
        const message =
          data.error || "Analysis failed. Please try again later.";
        toast.error(message);
        settle(() => handlers.onError?.(new Error(message)));
      }
    } catch (error: unknown) {
      console.error(error);
      const message = "Failed to parse analysis progress.";
      toast.error(message);
      settle(() =>
        handlers.onError?.(
          error instanceof Error ? error : new Error(message),
        ),
      );
    }
  });

  es.onerror = () => {
    // Ignore late errors after we already closed on a terminal event.
    if (settled) return;
    // EventSource auto-retries while CONNECTING; treat CLOSED as fatal.
    if (es.readyState === EventSource.CLOSED) {
      const message = "Lost connection to analysis progress.";
      toast.error(message);
      settle(() => handlers.onError?.(new Error(message)));
      return;
    }
    // Abort retries on hard failures (401/403/404 show as error + reconnect loop).
    const message = "Failed to get analyze progress. Please try again later.";
    toast.error(message);
    settle(() => handlers.onError?.(new Error(message)));
  };

  return es;
}

export async function premiumAnalyzeResumeResult(
  jobId: string,
  options?: AuthOptions,
): Promise<PremiumAnalyzeResult | null> {
  try {
    const { data } = await axios.get<PremiumAnalyzeResult>(
      `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resume/analyze/result/${jobId}`,
      authConfig(options),
    );
    return data;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to get analyze result. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export type Resume = {
  resume_id: string;
  version: number;
  filename: string;
  storage_path: string;
  analysis?: Record<string, unknown> | null;
};

export async function getResumes(options?: AuthOptions): Promise<Resume[] | null> {
  try {
    const { data } = await axios.get<Resume[]>(
      `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resumes`,
      authConfig(options),
    );
    return data;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to get resumes. Please try again later.");
    console.error(errorMessage);
    return null;
  }
}

export async function getResume(resumeId: string, version?: number, options?: AuthOptions): Promise<Resume | null> {
  try {
    if (version === undefined) {
      const { data } = await axios.get<Resume>(
        `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resumes/${resumeId}`,
        authConfig(options),
      );
      return data;
    } else {
      const { data } = await axios.get<Resume>(
        `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resumes/${resumeId}?version=${version}`,
        authConfig(options),
      );
      return data;
    }
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to get resume. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export async function deleteResume(
  resumeId: string,
  version: number,
  options?: AuthOptions,
): Promise<boolean> {
  try {
    await axios.delete<void>(
      `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/resumes/${resumeId}?version=${version}`,
      authConfig(options),
    );
    return true;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = axiosErrorMessage(error, "Failed to delete resume. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return false;
  }
}