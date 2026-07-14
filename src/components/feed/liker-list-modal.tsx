"use client";

import {useEffect, useState, useTransition} from "react";
import {useRouter} from "next/navigation";

import type {ApiErrorResponse, LikeListResponse, LikeUserResponse,} from "@/lib/types";
import {Avatar} from "@/components/feed/Avatar";

type LikerListModalProps = {
    isOpen: boolean;
    title: string;
    endpoint: string | null;
    onClose: () => void;
};

function getInitials(fullName: string): string {
    return fullName
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

async function getErrorMessage(response: Response): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorResponse;
        return data.detail || "Unable to load likes.";
    } catch {
        return "Unable to load likes.";
    }
}

export default function LikerListModal({
                                           isOpen,
                                           title,
                                           endpoint,
                                           onClose,
                                       }: LikerListModalProps) {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [users, setUsers] = useState<LikeUserResponse[]>([]);

    useEffect(() => {
        if (!isOpen || !endpoint) {
            return;
        }

        async function loadLikers() {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(endpoint ? endpoint : "", {
                    method: "GET",
                    cache: "no-store",
                });

                if (response.status === 401) {
                    startTransition(() => {
                        router.replace("/login");
                        router.refresh();
                    });
                    return;
                }

                if (!response.ok) {
                    throw new Error(await getErrorMessage(response));
                }

                const data = (await response.json()) as LikeListResponse;
                setCount(data.count);
                setUsers(data.users);
            } catch (loadError) {
                setError(
                    loadError instanceof Error ? loadError.message : "Unable to load likes.",
                );
            } finally {
                setIsLoading(false);
            }
        }

        void loadLikers();
    }, [endpoint, isOpen, router, startTransition]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 py-6">
            <div className="w-full max-w-md rounded-4 bg-white p-4 shadow-2xl rounded-lg">
                <div className="mb-3 d-flex items-start justify-content-between gap-3">
                    <div>
                        <h4 className="mb-1 text-lg font-semibold text-slate-900">{title}</h4>
                        <p className="mb-0 text-sm text-slate-500">{count} people</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                    >
                        Close
                    </button>
                </div>

                {isLoading ? (
                    <p className="mb-0 text-sm text-slate-500">Loading likes...</p>
                ) : null}

                {error ? (
                    <div className="alert alert-danger mb-0" role="alert">
                        {error}
                    </div>
                ) : null}

                {!isLoading && !error && users.length === 0 ? (
                    <p className="mb-0 text-sm text-slate-500">No likes yet.</p>
                ) : null}

                {!isLoading && !error && users.length > 0 ? (
                    <div className="mt-3 max-h-[360px] overflow-y-auto">
                        <div className="grid gap-2">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="d-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 py-2 px-3"
                                >
                                    {
                                        user.profile_image_url ?
                                            <Avatar
                                                name={user.full_name}
                                                imageUrl={user.profile_image_url}
                                                sizeClassName={"h-8 w-8"}
                                                textClassName={"text-sm"}
                                            />
                                            :
                                            <div
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#377DFF] text-xs font-semibold text-white">
                                                {getInitials(user.full_name)}
                                            </div>
                                    }


                                    <div>
                                        <p className="mb-0 text-sm font-semibold text-slate-900">
                                            {user.full_name}
                                        </p>
                                        {/*<p className="mb-0 text-xs text-slate-500">
                                            {user.first_name} {user.last_name}
                                        </p>*/}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
