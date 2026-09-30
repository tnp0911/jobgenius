export type LoginRequest = {
    email: string;
    password: string;
};

export type RegisterRequest = {
    name: string;
    email: string;
    password: string;
};

export type AuthOptions = {
    signal?: AbortSignal;
    withCredentials?: boolean;
    timeout?: number;
    headers?: Record<string, string>;
};

export type UpdatePasswordRequest = {
    oldPassword: string;
    newPassword: string;
};

export type UpdatePasswordResponse = {
    error?: string;
    message?: string;
};

export type ForgotPasswordRequest = {
    email: string;
    newPassword: string;
};

export type ForgotPasswordResponse = {
    error?: string;
    message?: string;
};