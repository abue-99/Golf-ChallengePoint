import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Allowed: mp4, webm, ogg, mov" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 500 MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const filename = `${randomUUID()}.${ext}`;

    // Save to public/uploads — served as /uploads/<filename>
    // NOTE: For production deployments, replace with cloud storage (S3, etc.)
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("[/api/upload POST]", err);
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}
