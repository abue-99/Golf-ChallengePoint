import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

type ProxyJsonRequestOptions = {
  path: string;
  method?: string;
  body?: unknown;
  cache?: RequestCache;
  fallbackBody?: unknown;
  missingTokenBody?: unknown;
};

const API_URL = process.env.API_URL || "http://golf_api:4000";
const secure = process.env.SECURE_COOKIES === "true";

function buildCookieHeader(refreshToken: string) {
  return `refresh_token=${refreshToken}`;
}

function buildTokenCookieOptions() {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    maxAge: 15 * 60,
    path: "/",
  };
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set("token", "", { maxAge: 0, path: "/" });
  response.cookies.set("refresh_token", "", { maxAge: 0, path: "/" });
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: buildCookieHeader(refreshToken) },
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as
    | { accessToken?: unknown }
    | null;
  const accessToken =
    typeof data?.accessToken === "string" ? data.accessToken : null;

  if (!accessToken) {
    return null;
  }

  return { accessToken, response };
}

function buildRequestBody(body: unknown) {
  if (body === undefined) return undefined;
  return JSON.stringify(body);
}

async function executeApiRequest(
  path: string,
  method: string,
  accessToken: string,
  body: unknown,
  cache: RequestCache | undefined,
) {
  const headers: Record<string, string> = {
    Authorization: "Bear" + "er " + accessToken,
  };

  const requestBody = buildRequestBody(body);
  if (requestBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    cache,
  });
}

export async function proxyJsonWithAuthRetry({
  path,
  method = "GET",
  body,
  cache,
  fallbackBody = {},
  missingTokenBody = null,
}: ProxyJsonRequestOptions) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!token && !refreshToken) {
    return NextResponse.json(missingTokenBody, { status: 401 });
  }

  let response = token
    ? await executeApiRequest(path, method, token, body, cache)
    : null;
  let refreshedAuth:
    | { accessToken: string; response: Response }
    | null = null;

  if (!response || response.status === 401) {
    if (!refreshToken) {
      return NextResponse.json(missingTokenBody, { status: 401 });
    }

    refreshedAuth = await refreshAccessToken(refreshToken);
    if (!refreshedAuth) {
      const unauthorized = NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 401 },
      );
      clearAuthCookies(unauthorized);
      return unauthorized;
    }

    response = await executeApiRequest(
      path,
      method,
      refreshedAuth.accessToken,
      body,
      cache,
    );
  }

  const responseBody = await response
    .json()
    .catch(() => fallbackBody);
  const browserResponse = NextResponse.json(responseBody, {
    status: response.status,
  });

  if (refreshedAuth) {
    browserResponse.cookies.set(
      "token",
      refreshedAuth.accessToken,
      buildTokenCookieOptions(),
    );
    forwardRefreshTokenCookie(
      refreshedAuth.response,
      browserResponse,
      secure,
    );
  }

  return browserResponse;
}
