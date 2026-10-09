import axios from "axios";
import { authConfig } from "../auth/api";
import { toast } from "react-toastify";
import { axiosErrorMessage, isAborted } from "../utils/errorHelpers";
import { AuthOptions } from "@/auth/types";

export async function getAllUsers(options?: AuthOptions): Promise<unknown> {
    try {
        const { data } = await axios.get(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/users`,
            authConfig(options),
        );
        return data;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to get all users. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}

export type CurrentUser = {
    name: string;
    email: string;
};

export async function getCurrentUser(
    options?: AuthOptions,
): Promise<CurrentUser | null> {
    try {
        const { data } = await axios.get<CurrentUser>(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/users/me`,
            authConfig(options),
        );
        return data;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to get current user. Please try again later.");
        if (axios.isAxiosError(error) && error.response?.status == 429) {
            toast.error(errorMessage);
        }
        console.error(errorMessage);
        return null;
    }
}

export async function getUserPlan(): Promise<string | null> {
    try {
        const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_FASTAPI_API_URL}/api/users/me`,
        authConfig(),
        );
        return data.plan as string;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to get user plan. Please try again later.");
        if (axios.isAxiosError(error) && error.response?.status == 429) {
            toast.error(errorMessage);
        }
        console.error(errorMessage);
        return null;
    }
}