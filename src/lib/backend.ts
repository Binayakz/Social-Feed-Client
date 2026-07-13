import "server-only";

import type {ApiErrorResponse} from "./types";

const DEFAULT_BACKEND_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export type ApiFetchOptions = Omit<RequestInit, "headers"> & {
    headers?: HeadersInit;
    token?: string | null;
};

export function getBackendApiBaseUrl(): string {
    const configured = process.env.BACKEND_API_BASE_URL?.trim();

    return (configured || DEFAULT_BACKEND_API_BASE_URL).replace(/\/+$/, "");
}

export function buildBackendUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendApiBaseUrl()}${normalizedPath}`;
}

function extractErrorMessage(payload: unknown): string | null {
    if (typeof payload === "string" && payload.trim()) {
        return payload;
    }

    if (payload && typeof payload === "object" && "detail" in payload) {
        const detail = (payload as ApiErrorResponse).detail;

        if (typeof detail === "string" && detail.trim()) {
            return detail;
        }
    }

    return null;
}

export async function apiFetch<T>(
    path: string,
    options: ApiFetchOptions = {},
): Promise<T> {
    const {token, headers: rawHeaders, body, cache, ...rest} = options;
    const headers = new Headers(rawHeaders);

    headers.set("Accept", "application/json");

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    if (body && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(buildBackendUrl(path), {
        ...rest,
        body,
        headers,
        cache: cache ?? "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (!response.ok) {
        let message = response.statusText || "Request failed";

        if (rawText) {
            if (contentType.includes("application/json")) {
                try {
                    const payload = JSON.parse(rawText) as unknown;
                    message = extractErrorMessage(payload) || message;
                } catch {
                    message = rawText.trim() || message;
                }
            } else {
                message = rawText.trim() || message;
            }
        }

        throw new ApiError(response.status, message);
    }

    if (!rawText) {
        return undefined as T;
    }

    if (contentType.includes("application/json")) {
        return JSON.parse(rawText) as T;
    }

    return rawText as T;
}
