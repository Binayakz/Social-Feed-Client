import {NextRequest, NextResponse} from "next/server";

import {ApiError, apiFetch} from "@/lib/backend";
import {AUTH_COOKIE_NAME} from "@/lib/session";
import type {LoginRequest, RegisterRequest, TokenResponse, UserResponse,} from "@/lib/types";

export const dynamic = "force-dynamic";

const authCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
};

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as RegisterRequest;

        const user = await apiFetch<UserResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const loginPayload: LoginRequest = {
            email: payload.email,
            password: payload.password,
        };

        const token = await apiFetch<TokenResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(loginPayload),
        });

        const response = NextResponse.json(
            {
                user,
            },
            {status: 201},
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
            {detail: "Unable to register user."},
            {status: 500},
        );
    }
}
