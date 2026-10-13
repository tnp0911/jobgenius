import axios from "axios";
import { authConfig } from "../auth/api";
import { toast } from "react-toastify";
import { AuthOptions } from "@/auth/types";
import { axiosErrorMessage, isAborted } from "@/utils/errorHelpers";

export async function sendEmailVerification(
    email: string,
    options?: AuthOptions,
): Promise<string | unknown | null> {
    try {
        const toSend = {
            email,
        };
        const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/send-verification-email`,
            toSend,
            authConfig(options),
        );
        return data.message;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to send email verification. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}

export async function verifyEmail(
    token: string,
    options?: AuthOptions,
): Promise<string | unknown | null> {
    try {
        const { data } = await axios.get(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/verify-email`,
            {
                ...authConfig(options),
                params: { token },
            },
        );
        return data.message;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to verify email. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}

export async function resendEmailVerification(
    email: string,
    options?: AuthOptions,
): Promise<string | unknown | null> {
    try {
        const toSend = {
            email,
        };
        const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/resend-verification-email`,
            toSend,
            authConfig(options),
        );
        return data.message;
    } catch (error: unknown) {
        if (isAborted(error)) return null;
        const errorMessage = axiosErrorMessage(error, "Failed to resend email verification. Please try again later.");
        toast.error(errorMessage);
        console.error(errorMessage);
        return null;
    }
}
