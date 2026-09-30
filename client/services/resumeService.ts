import axios, { AxiosError } from "axios";
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

export type PremiumAnalyzeResult = {
  intent: Record<string, unknown>;
  analyzer: Record<string, unknown>;
  ats: Record<string, unknown>;
  optimizer: Record<string, unknown>;
  feedback: Record<string, unknown> | string;
  job_finder: Record<string, unknown> | unknown | null;
};

export async function premiumAnalyzeResume(
  resumePdf: File,
  jdText: string = "",
  userGoal: string = "",
  includesJobFinder: boolean = false,
  options?: AuthOptions,
): Promise<PremiumAnalyzeResult | null> {
  try {
    const formData = new FormData();
    formData.append("resume_pdf", resumePdf);
    formData.append("jd_text", jdText);
    formData.append("user_goal", userGoal);
    formData.append("includes_job_finder", includesJobFinder.toString());

    const { data } = await axios.post<PremiumAnalyzeResult>(
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
    toast.error(errorMessage);
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