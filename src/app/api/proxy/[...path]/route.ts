import {NextRequest, NextResponse} from "next/server";

import {AUTH_COOKIE_NAME} from "@/lib/session";
import {buildBackendUrl} from "@/lib/backend";

export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{
        path: string[];
    }>;
};

const expiredCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
};

async function buildForwardBody(request: NextRequest): Promise<BodyInit | undefined> {
    if (request.method === "GET" || request.method === "HEAD") {
        return undefined;
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const nextFormData = new FormData();

        formData.forEach((value, key) => {
            nextFormData.append(key, value);
        });

        return nextFormData;
    }

    if (
        contentType.includes("application/json") ||
        contentType.includes("text/plain") ||
        contentType.includes("application/x-www-form-urlencoded")
    ) {
        return await request.text();
    }

    const arrayBuffer = await request.arrayBuffer();
    return arrayBuffer.byteLength > 0 ? arrayBuffer : undefined;
}

async function proxyRequest(
    request: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;

    if (!token) {
        return NextResponse.json(
            {detail: "Authentication required."},
            {status: 401},
        );
    }

    const {path} = await context.params;
    const joinedPath = path.join("/");
    const backendUrl = new URL(buildBackendUrl(joinedPath));

    backendUrl.search = request.nextUrl.search;

    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${token}`);

    const contentType = request.headers.get("content-type");
    if (contentType && !contentType.includes("multipart/form-data")) {
        headers.set("Content-Type", contentType);
    }

    const backendResponse = await fetch(backendUrl.toString(), {
        method: request.method,
        headers,
        body: await buildForwardBody(request),
        cache: "no-store",
    });

    const responseContentType =
        backendResponse.headers.get("content-type") || "application/json";
    const responseText = await backendResponse.text();

    const response = new NextResponse(responseText || null, {
        status: backendResponse.status,
    });

    response.headers.set("Content-Type", responseContentType);

    if (backendResponse.status === 401) {
        response.cookies.set(AUTH_COOKIE_NAME, "", expiredCookieOptions);
    }

    return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return proxyRequest(request, context);
}
