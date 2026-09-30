import axios from "axios";
import { AuthOptions, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, RegisterRequest, UpdatePasswordRequest, UpdatePasswordResponse } from "./types";

export const authConfig = (options?: AuthOptions) => ({
    signal: options?.signal,
    withCredentials: options?.withCredentials ?? true,
    timeout: options?.timeout ?? 4000,
    headers: options?.headers ?? {},
});

export async function handleAnonymousReady(): Promise<void> {
    try {
        await axios.get(
            `${process.env.NEXT_PUBLIC_SPRING_API_URL}/anonymous_ready`,
            authConfig(),
        );
    }
    catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
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
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
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
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
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
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
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
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
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
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Too many requests. Please try again later.");
        }
        else if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        else if (error instanceof Error) {
            throw new Error(error.message);
        }
        else {
            throw new Error("An unknown error occurred.");
        }
    }
}