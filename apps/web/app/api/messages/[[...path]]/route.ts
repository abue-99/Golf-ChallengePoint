import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * Messages between coaches and players:
 *   GET  /api/messages                 → /messages
 *   GET  /api/messages/unread          → /messages/unread
 *   GET  /api/messages/with/:userId    → /messages/with/:userId
 *   POST /api/messages/with/:userId    → /messages/with/:userId
 */
async function proxy(req: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const target = path.map((segment) => encodeURIComponent(segment)).join("/");
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : undefined;
    return await proxyJsonWithAuthRetry({
      path: `/messages${target ? `/${target}` : ""}${req.nextUrl.search}`,
      method: req.method,
      body,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/messages]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
