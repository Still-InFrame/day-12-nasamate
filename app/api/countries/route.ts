import { NextResponse } from "next/server";
import {
  COUNTRIES_KEY,
  COUNTRY_FIELDS,
  COUNTRY_FIELDS_OMIT,
  normalizeCountry,
  type Country,
} from "@/lib/countries";

// Fetch every country once and cache for 3 days. The free tier allows 500
// req/month; this costs ~3 calls (249 countries / 100 per page) per cache
// window, so the monthly budget is effectively untouched. All country clicks in
// the UI read the client-side copy of this payload — they never hit the API.
export const revalidate = 259200; // 3 days

const BASE = "https://api.restcountries.com/countries/v5";
const PAGE = 100;

export async function GET() {
  if (!COUNTRIES_KEY) {
    // Graceful degradation: globe + events still work without the country layer.
    return NextResponse.json({ countries: [], configured: false });
  }

  const headers = { Authorization: `Bearer ${COUNTRIES_KEY}` };
  const raw: Record<string, unknown>[] = [];

  try {
    for (let offset = 0; offset < 300; offset += PAGE) {
      const url = `${BASE}?response_fields=${COUNTRY_FIELDS}&response_fields_omit=${COUNTRY_FIELDS_OMIT}&limit=${PAGE}&offset=${offset}`;
      const res = await fetch(url, { headers, next: { revalidate } });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Countries upstream ${res.status}`, countries: [] },
          { status: 502 },
        );
      }
      const body = await res.json();
      const objects: Record<string, unknown>[] = body?.data?.objects ?? [];
      raw.push(...objects);
      if (!body?.data?.meta?.more) break;
    }
  } catch {
    return NextResponse.json({ error: "Countries unreachable", countries: [] }, { status: 502 });
  }

  const countries: Country[] = raw
    .map(normalizeCountry)
    .filter((c): c is Country => c !== null);

  return NextResponse.json({ countries, configured: true });
}
