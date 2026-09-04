import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function GET(req: NextRequest) {
  try {
    const visibility = req.nextUrl.searchParams.get("visibility");
    const params = new URLSearchParams();
    if (visibility) params.set("visibility", visibility);
    const path = params.toString() ? `/journeys?${params}` : "/journeys";

    return await proxyJsonWithAuthRetry({
      path,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys GET]", err);
    return Response.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await proxyJsonWithAuthRetry({
      path: "/journeys",
      method: "POST",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
