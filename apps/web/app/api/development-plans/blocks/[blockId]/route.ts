import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { blockId } = await params;
  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/development-plans/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/development-plans/blocks/[blockId] PATCH]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { blockId } = await params;
  try {
    const res = await fetch(`${API_URL}/development-plans/blocks/${blockId}`, {
      method: "DELETE",
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/development-plans/blocks/[blockId] DELETE]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
