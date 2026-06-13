import { NASA_KEY } from "@/lib/nasa";

// Proxy for EPIC archive PNGs. The archive requires the NASA key as a query
// param, so fetching it directly from the browser would leak the key into the
// network tab. We fetch server-side and stream the bytes back instead. Inputs
// are strictly validated to keep this from becoming an open proxy (SSRF/path
// traversal): only the exact archive path shape is ever constructed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = searchParams.get("y");
  const m = searchParams.get("m");
  const d = searchParams.get("d");
  const name = searchParams.get("name");

  if (
    !y || !m || !d || !name ||
    !/^\d{4}$/.test(y) ||
    !/^\d{2}$/.test(m) ||
    !/^\d{2}$/.test(d) ||
    !/^epic_[A-Za-z0-9_]+$/.test(name)
  ) {
    return new Response("Bad request", { status: 400 });
  }

  // These PNGs are ~4MB — over Next's 2MB fetch-cache ceiling, so we skip the
  // server data cache and let the browser cache via Cache-Control below.
  const url = `https://api.nasa.gov/EPIC/archive/natural/${y}/${m}/${d}/png/${name}.png?api_key=${NASA_KEY}`;
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return new Response("Upstream error", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
