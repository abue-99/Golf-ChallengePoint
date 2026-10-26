import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * Player game (XP, missions, team):
 *   GET  /api/game/me | /path | /team | /reviews | /missions/:id
 *   POST /api/game/inbox/accept | /missions/:id/start | /missions/:id/complete
 *        /reviews/seen | /kudos/:eventId | /challenges/:id/entries
 *   PATCH /api/game/me/goal
 */
async function proxy(req: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const target = path.map((segment) => encodeURIComponent(segment)).join("/");
    const body =
      req.method === "GET" ? undefined : await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: `/game${target ? `/${target}` : ""}${req.nextUrl.search}`,
      method: req.method,
      body,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/game]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
