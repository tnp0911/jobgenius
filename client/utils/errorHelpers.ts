import axios, { AxiosError } from "axios";

/** True when the request was aborted on purpose (navigation, newer request, etc.). */
export function isAborted(error: unknown): boolean {
    if (axios.isCancel(error)) return true;
    if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return true;
    if (error instanceof DOMException && error.name === "AbortError") return true;
    if (error instanceof Error && error.name === "CanceledError") return true;
    return false;
}

export function axiosErrorMessage(error: unknown, defaultMessage: string = "An unknown error occurred. Please try again later."): string {
    if (isAborted(error)) {
      return defaultMessage;
    }
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : "Request failed.";
    }
    if (error instanceof AxiosError && error.response?.status === 400) {
        return error.response.data.detail;
    }
    if (error instanceof AxiosError && error.response?.status === 401) {
        return "Unauthorized.";
    }
    if (error instanceof AxiosError && error.response?.status === 403) {
        return "Forbidden.";
    }
    if (error instanceof AxiosError && error.response?.status === 404) {
        return "Not Found.";
    }
    if (error instanceof AxiosError && error.response?.status === 429) {
        return "Too Many Requests. Please try again later.";
    }
    if (error instanceof AxiosError && error.response?.status === 500) {
        return "Internal Server Error.";
    }
    return error.message || defaultMessage;
}
