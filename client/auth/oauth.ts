import { toast } from "react-toastify";

export function handleGoogleLogin(): void {
    globalThis.location.href = `${process.env.NEXT_PUBLIC_SPRING_API_URL}/oauth2/authorization/google`;
}

export function handleFacebookLogin(): void {
    toast.error('This feature is not available yet. Sorry for the inconvenience.');
}