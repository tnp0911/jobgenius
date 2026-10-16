import axios from "axios";
import {
    AuthOptions,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResult,
    MfaCodeRequest,
    RegisterGauthResponse,
    RegisterRequest,
    UpdatePasswordRequest,
    UpdatePasswordResponse,
} from "./types";
import { isAborted } from "@/utils/errorHelpers";

export const authConfig = (options?: AuthOptions) => ({
    signal: options?.signal,
    withCredentials: options?.withCredentials ?? true,
    timeout: options?.timeout ?? 4000,
    headers: options?.headers ?? {},
});

function extractAuthErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === "string" && data.trim()) {
            return data;
        }
        if (data && typeof data === "object") {
            const body = data as { message?: string; error?: string };
            if (typeof body.message === "string" && body.message.trim()) {
                return body.message;
            }
            if (typeof body.error === "string" && body.error.trim()) {
                return body.error;
            }
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "An unknown error occurred.";
}

function rethrowAuthError(error: unknown): never {
    if (isAborted(error)) {
        throw error;
    }
    if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw new Error("Too many requests. Please try again later.");
    }
    throw new Error(extractAuthErrorMessage(error));
}

export async function handleAnonymousReady(): Promise<void> {
    try {
        await axios.get(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/anonymous_ready`,
            authConfig(),
        );
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleLogin(
    loginRequest: LoginRequest,
    options?: AuthOptions,
): Promise<LoginResult> {
    try {
        const response = await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/login`,
            loginRequest,
            authConfig(options),
        );
        return { mfaRequired: response.status === 202 };
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleRegister(
    registerRequest: RegisterRequest,
    options?: AuthOptions,
): Promise<void> {
    try {
        await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/register`,
            registerRequest,
            authConfig(options),
        );
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleRefreshToken(): Promise<void> {
    try {
        await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/refresh`,
            {},
            authConfig(),
        )
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}
export async function handleLogout(): Promise<void> {
    await axios.post(
        `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/logout`,
        {},
        authConfig(),
    );
}

export async function handleUpdatePassword(updatePasswordRequest: UpdatePasswordRequest): Promise<UpdatePasswordResponse> {
    try {
        const response = await axios.patch<UpdatePasswordResponse>(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/update-password`,
            updatePasswordRequest,
            authConfig(),
        );
        return response.data;
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleForgotPassword(forgotPasswordRequest: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    try {
        const response = await axios.patch<ForgotPasswordResponse>(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/forgot-password`,
            forgotPasswordRequest,
            authConfig(),
        );
        return response.data;
    }
    catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleRegisterGauth(
    options?: AuthOptions,
): Promise<RegisterGauthResponse> {
    try {
        const response = await axios.post<RegisterGauthResponse>(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/register-gauth`,
            {},
            authConfig({ ...options, timeout: options?.timeout ?? 10000 }),
        );
        return response.data;
    } catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleVerifyGauthRegistration(
    request: MfaCodeRequest,
    options?: AuthOptions,
): Promise<void> {
    try {
        await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/verify-gauth-for-registration`,
            request,
            authConfig(options),
        );
    } catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleLoginGauth(
    request: MfaCodeRequest,
    options?: AuthOptions,
): Promise<void> {
    try {
        await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/login-gauth`,
            request,
            authConfig(options),
        );
    } catch (error: unknown) {
        rethrowAuthError(error);
    }
}

export async function handleDisableGauth(
    request: MfaCodeRequest,
    options?: AuthOptions,
): Promise<void> {
    try {
        await axios.delete(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/disable-gauth`,
            {
                ...authConfig(options),
                data: request,
            },
        );
    } catch (error: unknown) {
        rethrowAuthError(error);
    }
}