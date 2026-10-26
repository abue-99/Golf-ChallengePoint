import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * Web push settings:
 *   GET   /api/push              → settings, public key, devices
 *   PATCH /api/push              → { assignments?: boolean, … }
 *   POST  /api/push/subscribe | /unsubscribe | /test
 */
async function proxy(req: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const target = path.map((segment) => encodeURIComponent(segment)).join("/");
    const body =
      req.method === "GET" ? undefined : await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: `/push${target ? `/${target}` : ""}`,
      method: req.method,
      body,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/push]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
