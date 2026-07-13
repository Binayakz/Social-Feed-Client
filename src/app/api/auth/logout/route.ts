import {NextResponse} from "next/server";

import {AUTH_COOKIE_NAME} from "@/lib/session";

export const dynamic = "force-dynamic";

const expiredCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
};

export async function POST() {
    const response = NextResponse.json(
        {success: true},
        {status: 200},
    );

    response.cookies.set(AUTH_COOKIE_NAME, "", expiredCookieOptions);

    return response;
}
