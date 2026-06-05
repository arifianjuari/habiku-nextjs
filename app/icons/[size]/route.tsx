import { ImageResponse } from "next/og";
import { HabikuIconImage } from "@/lib/habiku-icon-image";

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await context.params;
  const parsedSize = Number.parseInt(sizeParam, 10);

  if (!ALLOWED_SIZES.has(parsedSize)) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(<HabikuIconImage size={parsedSize} />, {
    width: parsedSize,
    height: parsedSize,
  });
}
