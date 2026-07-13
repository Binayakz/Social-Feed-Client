import {NextRequest, NextResponse} from "next/server";

import {ApiError, apiFetch} from "@/lib/backend";
import {AUTH_COOKIE_NAME} from "@/lib/session";
import type {UserResponse} from "@/lib/types";

export const dynamic = "force-dynamic";

const expiredCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
};

export async function GET(request: NextRequest) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;

    if (!token) {
        return NextResponse.json(
            {detail: "Authentication required."},
            {status: 401},
        );
    }

    try {
        const user = await apiFetch<UserResponse>("/auth/me", {
            method: "GET",
            token,
        });

        return NextResponse.json(user, {status: 200});
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            const response = NextResponse.json(
                {detail: error.message},
                {status: 401},
            );

            response.cookies.set(AUTH_COOKIE_NAME, "", expiredCookieOptions);

            return response;
        }

        if (error instanceof ApiError) {
            return NextResponse.json(
                {detail: error.message},
                {status: error.status},
            );
        }

        return NextResponse.json(
            {detail: "Unable to load current user."},
            {status: 500},
        );
    }
}
