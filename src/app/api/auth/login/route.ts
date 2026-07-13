import {NextRequest, NextResponse} from "next/server";

import {ApiError, apiFetch} from "@/lib/backend";
import {AUTH_COOKIE_NAME} from "@/lib/session";
import type {LoginRequest, TokenResponse, UserResponse} from "@/lib/types";

export const dynamic = "force-dynamic";

const authCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
};

export async function POST(request: NextRequest) {
    try {
        const credentials = (await request.json()) as LoginRequest;

        const token = await apiFetch<TokenResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        });

        const user = await apiFetch<UserResponse>("/auth/me", {
            method: "GET",
            token: token.access_token,
        });

        const response = NextResponse.json(
            {
                user,
            },
            {status: 200},
        );

        response.cookies.set(AUTH_COOKIE_NAME, token.access_token, authCookieOptions);

        return response;
    } catch (error) {
        if (error instanceof ApiError) {
            return NextResponse.json(
                {detail: error.message},
                {status: error.status},
            );
        }

        return NextResponse.json(
            {detail: "Unable to sign in."},
            {status: 500},
        );
    }
}
