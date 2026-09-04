import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/journeys/${encodeURIComponent(id)}`,
      cache: "no-store",
      fallbackBody: {},
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys/[id] GET]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    return await proxyJsonWithAuthRetry({
      path: `/journeys/${encodeURIComponent(id)}`,
      method: "PATCH",
      body,
      fallbackBody: {},
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys/[id] PATCH]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/journeys/${encodeURIComponent(id)}`,
      method: "DELETE",
      fallbackBody: {},
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys/[id] DELETE]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
