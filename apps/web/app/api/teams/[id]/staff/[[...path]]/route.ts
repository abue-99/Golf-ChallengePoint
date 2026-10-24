import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

type Context = { params: Promise<{ id: string; path?: string[] }> };

/**
 * Coaching staff of a team:
 *   GET    /api/teams/:id/staff               → list
 *   GET    /api/teams/:id/staff/candidates    → coaches who can be added
 *   POST   /api/teams/:id/staff               → add { coachId, role }
 *   POST   /api/teams/:id/staff/head          → hand over { coachId }
 *   PUT    /api/teams/:id/staff/:coachId      → change role { role }
 *   DELETE /api/teams/:id/staff/:coachId      → remove / leave
 */
async function proxy(req: NextRequest, context: Context) {
  try {
    const { id, path = [] } = await context.params;
    const rest = path.map((segment) => encodeURIComponent(segment)).join("/");
    const hasBody = req.method === "POST" || req.method === "PUT";
    return await proxyJsonWithAuthRetry({
      path: `/teams/${encodeURIComponent(id)}/staff${rest ? `/${rest}` : ""}`,
      method: req.method,
      body: hasBody ? await req.json().catch(() => ({})) : undefined,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/teams/[id]/staff]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
