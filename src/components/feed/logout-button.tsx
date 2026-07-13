"use client";

import {useRouter} from "next/navigation";
import {useState, useTransition} from "react";

import type {ApiErrorResponse} from "@/lib/types";

async function getErrorMessage(response: Response): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorResponse;
        return data.detail || "Unable to sign out.";
    } catch {
        return "Unable to sign out.";
    }
}

export default function LogoutButton() {
    const router = useRouter();
    const [isRedirecting, startTransition] = useTransition();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBusy = isSubmitting || isRedirecting;

    async function handleLogout() {
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            startTransition(() => {
                router.replace("/login");
                router.refresh();
            });
        } catch (logoutError) {
            setError(
                logoutError instanceof Error ? logoutError.message : "Unable to sign out.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="d-flex flex-column align-items-end">
            <button
                type="button"
                onClick={handleLogout}
                disabled={isBusy}
                className="inline-flex items-center justify-center rounded-full bg-[#377DFF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#276CEA] disabled:opacity-60"
            >
                {isBusy ? "Logging out..." : "Log out"}
            </button>

            {error ? (
                <p className="mt-2 text-end text-sm text-red-500">{error}</p>
            ) : null}
        </div>
    );
}
