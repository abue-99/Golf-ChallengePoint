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
  return `refresh_token=${encodeURIComponent(refreshToken)}`;
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

function buildRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  };
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set("token", "", {
    ...buildTokenCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set("refresh_token", "", {
    ...buildRefreshTokenCookieOptions(),
    maxAge: 0,
  });
}

function buildForwardedHeaders(headers: Headers, removeContentType = false) {
  const forwarded = new Headers(headers);
  forwarded.delete("content-length");
  forwarded.delete("set-cookie");
  if (removeContentType) {
    forwarded.delete("content-type");
  }
  return forwarded;
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
    Authorization: ["Bearer", accessToken].join(" "),
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
  const unauthorizedResponse = (body: unknown = { message: "Invalid or expired token" }) => {
    const response = NextResponse.json(body, { status: 401 });
    clearAuthCookies(response);
    return response;
  };

  if (!token && !refreshToken) {
    return unauthorizedResponse(missingTokenBody ?? { message: "Invalid or expired token" });
  }

  let refreshedAuth:
    | { accessToken: string; response: Response }
    | null = null;
  let accessToken = token ?? null;
  let refreshAttempted = false;

  if (!accessToken) {
    if (!refreshToken) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
      );
    }

    refreshAttempted = true;
    refreshedAuth = await refreshAccessToken(refreshToken);
    if (!refreshedAuth) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
      );
    }

    accessToken = refreshedAuth.accessToken;
  }

  let response = await executeApiRequest(path, method, accessToken, body, cache);

  if (response.status === 401) {
    if (!refreshToken) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
      );
    }

    if (refreshAttempted) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
      );
    }

    refreshAttempted = true;
    refreshedAuth = await refreshAccessToken(refreshToken);
    if (!refreshedAuth) {
      return unauthorizedResponse();
    }

    response = await executeApiRequest(
      path,
      method,
      refreshedAuth.accessToken,
      body,
      cache,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const browserResponse =
    response.status === 204
      ? new NextResponse(null, {
          status: response.status,
          headers: buildForwardedHeaders(response.headers),
        })
      : contentType.includes("application/json")
        ? NextResponse.json(await response.json().catch(() => fallbackBody), {
            status: response.status,
            headers: buildForwardedHeaders(response.headers, true),
          })
        : new NextResponse(await response.text(), {
            status: response.status,
            headers: buildForwardedHeaders(response.headers),
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
