import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

type Context = { params: Promise<{ path: string[] }> };

/**
 * Proxies the coach home sub-resources to Nest:
 *   /api/coach/roster/feedback[...]            → /coach/roster/feedback[...]
 *   /api/coach/roster/players/:id/notes        → /coach/roster/players/:id/notes
 *   /api/coach/roster/notes/:noteId            → /coach/roster/notes/:noteId
 */
async function proxy(req: NextRequest, context: Context) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  const { path } = await context.params;
  const target = path.map((segment) => encodeURIComponent(segment)).join("/");
  const search = req.nextUrl.search;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(`${API_URL}/coach/roster/${target}${search}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? body || "{}" : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
