import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

type ProxyJsonRequestOptions = {
  path: string;
  method?: string;
  body?: unknown;
  cache?: RequestCache;
  missingTokenBody?: unknown;
};

const API_URL = process.env.API_URL || "http://golf_api:4000";
const secure = process.env.SECURE_COOKIES === "true";

function buildCookieHeader(cookiePairs: Array<{ name: string; value: string }>) {
  return cookiePairs
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
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

async function refreshAccessToken(cookieHeader: string) {
  console.log("refresh started");
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
    credentials: "include",
    cache: "no-store",
  });
  console.log("refresh status", response.status);

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
  if (body === undefined) return { body: undefined, isJson: false };
  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  ) {
    return { body, isJson: false };
  }
  return { body: JSON.stringify(body), isJson: true };
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

  const { body: requestBody, isJson } = buildRequestBody(body);
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: requestBody as BodyInit | undefined,
    cache,
  });
}

/**
 * Proxies a request to the API using the access token cookie, refreshes once if
 * needed, and forwards any rotated auth cookies back to the browser.
 */
export async function proxyJsonWithAuthRetry({
  path,
  method = "GET",
  body,
  cache,
  missingTokenBody = null,
}: ProxyJsonRequestOptions) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;
  console.log("token present", Boolean(token));
  console.log("refresh token present", Boolean(refreshToken));
  const cookieHeader = buildCookieHeader(
    [
      token ? { name: "token", value: token } : null,
      refreshToken ? { name: "refresh_token", value: refreshToken } : null,
    ].filter((cookie): cookie is { name: string; value: string } => Boolean(cookie)),
  );
  const unauthorizedResponse = (
    body: unknown = { message: "Invalid or expired token" },
    clearCookies = false,
  ) => {
    const response = NextResponse.json(body, { status: 401 });
    if (clearCookies) {
      clearAuthCookies(response);
    }
    return response;
  };

  if (!token && !refreshToken) {
    return unauthorizedResponse(
      missingTokenBody ?? { message: "Invalid or expired token" },
    );
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
    refreshedAuth = await refreshAccessToken(cookieHeader);
    if (!refreshedAuth) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
        true,
      );
    }

    accessToken = refreshedAuth.accessToken;
  }

  let response = await executeApiRequest(path, method, accessToken, body, cache);

  if (response.status === 401 && refreshToken && !refreshAttempted) {
    refreshAttempted = true;
    refreshedAuth = await refreshAccessToken(cookieHeader);
    if (!refreshedAuth) {
      return unauthorizedResponse(
        missingTokenBody ?? { message: "Invalid or expired token" },
        true,
      );
    }

    response = await executeApiRequest(
      path,
      method,
      refreshedAuth.accessToken,
      body,
      cache,
    );
    console.log("retry status", response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let browserResponse: NextResponse;

  if (!contentType.includes("application/json")) {
    browserResponse = new NextResponse(response.body, {
      status: response.status,
      headers: buildForwardedHeaders(response.headers),
    });
  } else {
    const responseText =
      response.status === 204 || response.status === 205 ? "" : await response.text();
    browserResponse =
      responseText.length === 0
        ? new NextResponse(null, {
            status: response.status,
            headers: buildForwardedHeaders(response.headers),
          })
        : (() => {
            try {
              return NextResponse.json(JSON.parse(responseText), {
                status: response.status,
                headers: buildForwardedHeaders(response.headers, true),
              });
            } catch {
              return new NextResponse(responseText, {
                status: response.status,
                headers: buildForwardedHeaders(response.headers),
              });
            }
          })();
  }

  if (refreshedAuth) {
    browserResponse.cookies.set(
      "token",
      refreshedAuth.accessToken,
      buildTokenCookieOptions(),
    );
    forwardRefreshTokenCookie(refreshedAuth.response, browserResponse, secure);
  }

  return browserResponse;
}
