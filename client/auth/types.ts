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

export type ForgotPasswordSendLinkRequest = {
    email: string;
};

export type ForgotPasswordSendLinkResponse = {
    error?: string;
    message?: string;
};

export type ForgotPasswordUpdateRequest = {
    token: string;
    newPassword: string;
};

export type ForgotPasswordUpdateResponse = {
    error?: string;
    message?: string;
};

export type MfaCodeRequest = {
    code: number;
};

export type RegisterGauthResponse = {
    qrCodeUrl: string;
};

export type LoginResult = {
    mfaRequired: boolean;
};