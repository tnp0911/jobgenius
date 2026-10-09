import axios, { AxiosError } from "axios";
import { authConfig } from "../auth/api";
import { toast } from "react-toastify";
import { AuthOptions } from "@/auth/types";
import { axiosErrorMessage } from "@/utils/errorHelpers";

export async function createCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  options?: AuthOptions,
): Promise<string | null> {
  try {
    const { data } = await axios.post<{ checkoutUrl: string }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/create-checkout-session`,
      { successUrl, cancelUrl },
      authConfig(options),
    );
    return data.checkoutUrl;
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(error, "Failed to create checkout session. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}


export async function cancelSubscription(
  options?: AuthOptions,
): Promise<string | null> {
  try {
    const { data } = await axios.post<{ message: string }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/cancel-subscription`,
      {},
      authConfig(options ?? { timeout: 15_000 }),
    );
    return data.message;
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(error, "Failed to cancel subscription. Please try again later.");
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export type NextBillingInfo = {
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
};

export async function getNextBillingDate(
  options?: AuthOptions,
): Promise<NextBillingInfo | null> {
  try {
    const { data } = await axios.get<{
      nextBillingDate?: string;
      cancelAtPeriodEnd?: boolean;
    }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/next-billing-date`,
      authConfig(options),
    );
    return {
      nextBillingDate: data.nextBillingDate ?? null,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
    };
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(
      error,
      "Failed to load next billing date. Please try again later.",
    );
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export async function getInvoices(
  options?: AuthOptions,
): Promise<string[] | null> {
  try {
    const { data } = await axios.get<{ invoices: string[] }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/invoices`,
      authConfig(options),
    );
    return Array.isArray(data.invoices) ? data.invoices : [];
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(
      error,
      "Failed to load invoices. Please try again later.",
    );
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export async function getInvoiceHostedUrl(
  invoiceId: string,
  options?: AuthOptions,
): Promise<string | null> {
  try {
    const stripeInvoiceId = invoiceId.startsWith("invoice:")
      ? invoiceId.slice("invoice:".length)
      : invoiceId;

    const { data } = await axios.get<{ invoice: string | Record<string, unknown> }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/invoices/${encodeURIComponent(stripeInvoiceId)}`,
      authConfig(options),
    );

    const invoice =
      typeof data.invoice === "string"
        ? (JSON.parse(data.invoice) as Record<string, unknown>)
        : data.invoice;

    const hostedUrl = invoice?.hosted_invoice_url;
    return typeof hostedUrl === "string" && hostedUrl.length > 0
      ? hostedUrl
      : null;
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(
      error,
      "Failed to open invoice. Please try again later.",
    );
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}

export async function changePaymentMethod(
  options?: AuthOptions,
): Promise<string | null> {
  try {
    const { data } = await axios.post<{ stripeUrl: string }>(
      `${process.env.NEXT_PUBLIC_SPRING_API_URL}/api/payments/change-payment-method`,
      {},
      authConfig(options),
    );
    return data.stripeUrl ?? null;
  } catch (error: unknown) {
    const errorMessage = axiosErrorMessage(
      error,
      "Failed to start payment method update. Please try again later.",
    );
    toast.error(errorMessage);
    console.error(errorMessage);
    return null;
  }
}