import { ImageResponse } from "next/og";
import { HabikuIconImage } from "@/lib/habiku-icon-image";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<HabikuIconImage size={32} />, {
    ...size,
  });
}
