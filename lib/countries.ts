// Shapes + helpers for the REST Countries (v5) layer. The free tier is capped
// at 500 requests/MONTH, so the whole strategy is: pull all ~249 countries once
// (3 paginated calls), cache for 3 days, and serve every click from that cache.
// `leaders` is a premium field we deliberately never request.

export const COUNTRIES_KEY = process.env.COUNTRIES_API_KEY || "";

// Branch-level allowlist → the API returns these as nested objects (dotted leaf
// paths would come back flattened instead). Heavy/premium branches are excluded.
export const COUNTRY_FIELDS = [
  "names",
  "codes",
  "flag",
  "capitals",
  "population",
  "area",
  "currencies",
  "languages",
  "timezones",
  "calling_codes",
  "region",
  "subregion",
  "continents",
  "borders",
  "landlocked",
  "cars",
  "memberships",
  "tlds",
  "government_type",
  "links",
  "coordinates",
].join(",");

export const COUNTRY_FIELDS_OMIT = "names.translations,names.alternates";

// Only the slice of the API record we actually surface in the panel. `ccn3` is
// the join key to the world-atlas polygon feature id.
export type Country = {
  ccn3: string;
  alpha2: string;
  alpha3: string;
  name: string;
  official: string;
  flagEmoji: string;
  capital: string | null;
  population: number | null;
  areaKm: number | null;
  region: string;
  subregion: string;
  currencies: string[];
  languages: string[];
  timezones: string[];
  callingCodes: string[];
  drivingSide: string | null;
  governmentType: string | null;
  landlocked: boolean;
  borders: string[];
  tlds: string[];
  memberships: string[];
  wikipedia: string | null;
  lat: number | null;
  lng: number | null;
};

// REST Countries returns rich nested objects; flatten to our Country shape.
// Defensive throughout — fields vary in presence across the 249 records.
export function normalizeCountry(raw: Record<string, unknown>): Country | null {
  const codes = (raw.codes ?? {}) as Record<string, string>;
  const ccn3 = codes.ccn3;
  if (!ccn3) return null;

  const names = (raw.names ?? {}) as { common?: string; official?: string };
  const flag = (raw.flag ?? {}) as { emoji?: string };
  const capitals = (raw.capitals ?? []) as { name?: string }[];
  const area = (raw.area ?? {}) as { kilometers?: number };
  const cars = (raw.cars ?? {}) as { driving_side?: string };
  const links = (raw.links ?? {}) as { wikipedia?: string };
  const coords = (raw.coordinates ?? {}) as { lat?: number; lng?: number };

  const currencies = raw.currencies && typeof raw.currencies === "object"
    ? Object.values(raw.currencies as Record<string, { name?: string }>)
        .map((c) => c?.name)
        .filter((n): n is string => Boolean(n))
    : [];

  const languages = Array.isArray(raw.languages)
    ? (raw.languages as { name?: string; english_name?: string }[])
        .map((l) => l?.english_name ?? l?.name)
        .filter((n): n is string => Boolean(n))
    : [];

  const memberships = raw.memberships && typeof raw.memberships === "object"
    ? Object.entries(raw.memberships as Record<string, boolean>)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : [];

  return {
    ccn3,
    alpha2: codes.alpha_2 ?? "",
    alpha3: codes.alpha_3 ?? "",
    name: names.common ?? "Unknown",
    official: names.official ?? "",
    flagEmoji: flag.emoji ?? "",
    capital: capitals[0]?.name ?? null,
    population: typeof raw.population === "number" ? raw.population : null,
    areaKm: typeof area.kilometers === "number" ? area.kilometers : null,
    region: (raw.region as string) ?? "",
    subregion: (raw.subregion as string) ?? "",
    currencies,
    languages,
    timezones: Array.isArray(raw.timezones) ? (raw.timezones as string[]) : [],
    callingCodes: Array.isArray(raw.calling_codes) ? (raw.calling_codes as string[]) : [],
    drivingSide: cars.driving_side ?? null,
    governmentType: (raw.government_type as string) ?? null,
    landlocked: raw.landlocked === true,
    borders: Array.isArray(raw.borders) ? (raw.borders as string[]) : [],
    tlds: Array.isArray(raw.tlds) ? (raw.tlds as string[]) : [],
    memberships,
    wikipedia: links.wikipedia ?? null,
    lat: typeof coords.lat === "number" ? coords.lat : null,
    lng: typeof coords.lng === "number" ? coords.lng : null,
  };
}

// Pretty labels for the membership chips we show.
export const MEMBERSHIP_LABELS: Record<string, string> = {
  un: "UN",
  eu: "EU",
  eurozone: "Eurozone",
  schengen: "Schengen",
  nato: "NATO",
  commonwealth: "Commonwealth",
  oecd: "OECD",
  g7: "G7",
  g20: "G20",
  brics: "BRICS",
  opec: "OPEC",
  african_union: "African Union",
  asean: "ASEAN",
  arab_league: "Arab League",
};
