import axios from "axios";
import { AuthOptions, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, RegisterRequest, UpdatePasswordRequest, UpdatePasswordResponse } from "./types";
import { isAborted } from "@/utils/errorHelpers";

export const authConfig = (options?: AuthOptions) => ({
    signal: options?.signal,
    withCredentials: options?.withCredentials ?? true,
    timeout: options?.timeout ?? 4000,
    headers: options?.headers ?? {},
});

function rethrowAuthError(error: unknown): never {
    if (isAborted(error)) {
        throw error;
    }
    if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw new Error("Too many requests. Please try again later.");
    }
    if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || error.message);
    }
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error("An unknown error occurred.");
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
): Promise<void> {
    try {
        await axios.post(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/auth/login`,
            loginRequest,
            authConfig(options),
        );
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