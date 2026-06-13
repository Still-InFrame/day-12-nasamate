import { NextResponse } from "next/server";
import { CATEGORY_COLORS, DEFAULT_COLOR, type EonetEvent } from "@/lib/nasa";

// EONET v3 — currently-open natural events worldwide. No API key required.
// We normalize each event down to a single placeable point so the globe layer
// stays simple: latest geometry, first category, a lat/lng, a color.
export const revalidate = 1800;

type Geometry = {
  type: string;
  date: string;
  coordinates: number[] | number[][] | number[][][];
};

export async function GET() {
  let data: { events?: unknown[] };
  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300",
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "EONET upstream error" }, { status: 502 });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "EONET unreachable" }, { status: 502 });
  }

  const events: EonetEvent[] = [];
  for (const raw of data.events ?? []) {
    const ev = raw as {
      id: string;
      title: string;
      link?: string;
      categories?: { id: string; title: string }[];
      sources?: { url: string }[];
      geometry?: Geometry[];
    };
    const geom = ev.geometry?.[ev.geometry.length - 1];
    if (!geom) continue;

    let lng: number;
    let lat: number;
    if (geom.type === "Point") {
      [lng, lat] = geom.coordinates as number[];
    } else if (geom.type === "Polygon") {
      // Storms/fires sometimes arrive as a polygon — drop a pin at its centroid.
      const ring = (geom.coordinates as number[][][])[0] ?? [];
      if (!ring.length) continue;
      let sx = 0;
      let sy = 0;
      for (const [x, y] of ring) {
        sx += x;
        sy += y;
      }
      lng = sx / ring.length;
      lat = sy / ring.length;
    } else {
      continue;
    }
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const cat = ev.categories?.[0] ?? { id: "unknown", title: "Event" };
    events.push({
      id: ev.id,
      title: ev.title,
      categoryId: cat.id,
      category: cat.title,
      color: CATEGORY_COLORS[cat.id] ?? DEFAULT_COLOR,
      lat,
      lng,
      date: geom.date,
      link: ev.sources?.[0]?.url ?? ev.link ?? "",
    });
  }

  return NextResponse.json({ events, count: events.length });
}
