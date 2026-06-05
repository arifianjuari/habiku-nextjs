import { ImageResponse } from "next/og";
import { HabikuIconImage } from "@/lib/habiku-icon-image";

export async function GET() {
  return new ImageResponse(<HabikuIconImage size={512} maskable />, {
    width: 512,
    height: 512,
  });
}
