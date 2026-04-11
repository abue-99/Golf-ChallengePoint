import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public (unauthenticated) endpoint that returns the list of clubs.
 * Used by the signup form so new users can pick their club without needing a token.
 */
export async function GET() {
  try {
    const clubs = await prisma.club.findMany({
      select: { id: true, name: true, city: true, country: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clubs);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
