import axios from "axios";

/** True when the request was aborted on purpose (navigation, newer request, etc.). */
export function isAborted(error: unknown): boolean {
    if (axios.isCancel(error)) return true;
    if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return true;
    if (error instanceof DOMException && error.name === "AbortError") return true;
    if (error instanceof Error && error.name === "CanceledError") return true;
    return false;
}

function apiErrorText(data: unknown): string | null {
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data !== "object" || data === null) return null;

    const record = data as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
        return record.message;
    }
    if (typeof record.detail === "string" && record.detail.trim()) {
        return record.detail;
    }
    return null;
}

export function axiosErrorMessage(error: unknown, defaultMessage: string = "An unknown error occurred. Please try again later."): string {
    if (isAborted(error)) {
      return defaultMessage;
    }
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : "Request failed.";
    }

    const fromApi = apiErrorText(error.response?.data);
    if (fromApi) return fromApi;

    const status = error.response?.status;
    if (status === 401) return "Unauthorized.";
    if (status === 403) return "Forbidden.";
    if (status === 404) return "Not Found.";
    if (status === 429) return "Too Many Requests. Please try again later.";
    if (status === 500) return "Internal Server Error.";

    return error.message || defaultMessage;
}
