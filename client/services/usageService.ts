import axios from "axios";
import { authConfig } from "@/auth/api"
import { AuthOptions } from "@/auth/types";
import { toast } from "react-toastify";
import { axiosErrorMessage, isAborted } from "../utils/errorHelpers";

export type UsageResponse = {
    usage: number;
    remaining_time: number;
    max_limit: number;
};

export async function getAnalyzerUsage(options?: AuthOptions): Promise<UsageResponse | null> {
    try {
        const { data } = await axios.get(
            `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/usage/analyzer`,
            authConfig(options),
        );
        return data as UsageResponse;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to get analyzer usage. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}

export async function getJobFinderUsage(options?: AuthOptions): Promise<UsageResponse | null> {
    try {
        const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/usage/job-finder`,
        authConfig(options),
        );
        return data as UsageResponse;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to get job finder usage. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}