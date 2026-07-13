import "server-only";

import {cache} from "react";

import {cookies} from "next/headers";
import {redirect} from "next/navigation";

import {ApiError, apiFetch} from "./backend";
import type {UserResponse} from "./types";

export const AUTH_COOKIE_NAME = "social_feed_access_token";

export const getSessionToken = cache(async (): Promise<string | null> => {
    const cookieStore = await cookies();
    return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
});

export const getCurrentUser = cache(async (): Promise<UserResponse | null> => {
    const token = await getSessionToken();

    if (!token) {
        return null;
    }

    try {
        return await apiFetch<UserResponse>("/auth/me", {
            method: "GET",
            token,
        });
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return null;
        }

        throw error;
    }
});

export async function requireSessionToken(): Promise<string> {
    const token = await getSessionToken();

    if (!token) {
        redirect("/login");
    }

    return token;
}

export async function requireCurrentUser(): Promise<UserResponse> {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    return user;
}

export async function redirectIfAuthenticated(): Promise<void> {
    const user = await getCurrentUser();

    if (user) {
        redirect("/feed");
    }
}
