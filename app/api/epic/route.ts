import { NextResponse } from "next/server";
import { NASA_KEY, type EpicFrame } from "@/lib/nasa";

// EPIC — DSCOVR's full-disc photos of Earth from ~1M miles out, for the most
// recent available day (a dozen-ish frames as Earth rotates). We never hand the
// NASA key to the client: image bytes are proxied through /api/epic/image, so
// the `src` we return points at our own origin.
export const revalidate = 3600;

export async function GET() {
  let data: unknown;
  try {
    const res = await fetch(
      `https://api.nasa.gov/EPIC/api/natural?api_key=${NASA_KEY}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "EPIC upstream error" }, { status: 502 });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "EPIC unreachable" }, { status: 502 });
  }

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ date: null, caption: null, frames: [] });
  }

  const frames: EpicFrame[] = data.map((d: { image: string; caption: string; date: string }) => {
    const [datePart] = d.date.split(" "); // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DD"
    const [y, m, day] = datePart.split("-");
    return {
      name: d.image,
      caption: d.caption,
      date: d.date,
      src: `/api/epic/image?y=${y}&m=${m}&d=${day}&name=${d.image}`,
    };
  });

  return NextResponse.json({
    date: frames[0].date,
    caption: frames[0].caption,
    frames,
  });
}
