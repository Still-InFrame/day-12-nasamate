"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { feature } from "topojson-client";
import {
  gibsSnapshotUrl,
  worldviewUrl,
  type EonetEvent,
  type EpicResponse,
} from "@/lib/nasa";
import { MEMBERSHIP_LABELS, type Country } from "@/lib/countries";
import type { CountryFeature } from "./components/GlobeView";

// react-globe.gl touches `window`, so it must never render on the server.
const GlobeView = dynamic(() => import("./components/GlobeView"), {
  ssr: false,
  loading: () => null,
});

function formatDate(raw: string): string {
  // EONET is ISO; EPIC is "YYYY-MM-DD HH:mm:ss" (UTC). Normalize both.
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactNumber(n: number): string {
  return n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}

type Category = { id: string; title: string; color: string; count: number };

export default function Home() {
  const [events, setEvents] = useState<EonetEvent[]>([]);
  const [epic, setEpic] = useState<EpicResponse | null>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<EonetEvent | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [epicOpen, setEpicOpen] = useState(false);
  const [rotating, setRotating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [eRes, pRes, cRes, topo] = await Promise.all([
          fetch("/api/eonet"),
          fetch("/api/epic"),
          fetch("/api/countries"),
          fetch("/geo/countries-110m.json").then((r) => r.json()),
        ]);
        if (!eRes.ok) throw new Error("Could not load live events");
        const eData: { events: EonetEvent[] } = await eRes.json();
        const pData: EpicResponse = pRes.ok
          ? await pRes.json()
          : { date: null, caption: null, frames: [] };
        const cData: { countries: Country[] } = cRes.ok
          ? await cRes.json()
          : { countries: [] };
        if (cancelled) return;

        // Join the country attributes onto the polygon shapes by numeric ISO code.
        const byCcn3 = new Map<number, Country>();
        for (const c of cData.countries) byCcn3.set(parseInt(c.ccn3, 10), c);
        const fc = feature(topo, topo.objects.countries) as unknown as {
          features: { id?: string; properties?: { name?: string } }[];
        };
        const feats: CountryFeature[] = fc.features.map((f) => ({
          ...f,
          properties: {
            name: f.properties?.name ?? "",
            country: byCcn3.get(parseInt(f.id ?? "", 10)) ?? null,
          },
        }));

        setEvents(eData.events);
        setActive(new Set(eData.events.map((e) => e.categoryId)));
        setEpic(pData);
        setCountries(feats);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo<Category[]>(() => {
    const map = new Map<string, Category>();
    for (const e of events) {
      const c = map.get(e.categoryId);
      if (c) c.count += 1;
      else map.set(e.categoryId, { id: e.categoryId, title: e.category, color: e.color, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [events]);

  const filtered = useMemo(
    () => events.filter((e) => active.has(e.categoryId)),
    [events, active],
  );

  function toggleCategory(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const epicFrame = epic?.frames[0];

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#05070f]">
      <GlobeView
        events={filtered}
        countries={countries}
        onEventClick={(e) => {
          setSelected(e);
          setCountry(null);
        }}
        onCountryClick={(c) => {
          setCountry(c);
          setSelected(null);
        }}
        focus={selected}
        selectedCountry={country}
        rotating={rotating}
      />

      {/* Header */}
      <header className="pointer-events-none absolute left-0 top-0 p-5 sm:p-7">
        <h1 className="text-xl font-semibold tracking-[0.2em] text-white sm:text-2xl">
          SPACESHIP EARTH
        </h1>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/55 sm:text-sm">
          Earth right now — live natural events from NASA EONET, on imagery from the
          DSCOVR satellite a million miles out. Tap a country to explore it.
        </p>
        {!loading && !error && (
          <p className="mt-3 font-mono text-xs text-white/70">
            <span className="text-emerald-400">●</span> {filtered.length} active{" "}
            {filtered.length === 1 ? "event" : "events"} worldwide
          </p>
        )}
      </header>

      {/* Category filters */}
      {!loading && !error && categories.length > 0 && (
        <div className="pointer-events-auto absolute left-5 top-44 flex max-w-[220px] flex-wrap gap-1.5 sm:left-7 sm:top-48">
          {categories.map((c) => {
            const on = active.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-transparent text-white/35"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: on ? c.color : "transparent",
                    boxShadow: on ? `0 0 6px ${c.color}` : "none",
                    border: `1px solid ${c.color}`,
                  }}
                />
                {c.title}
                <span className="opacity-50">{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* EPIC "Earth today" card */}
      {epicFrame && (
        <button
          onClick={() => setEpicOpen(true)}
          className="pointer-events-auto absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 pr-4 text-left backdrop-blur-md transition hover:bg-white/10 sm:bottom-7 sm:left-7"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={epicFrame.src}
            alt="Most recent full-disc image of Earth from DSCOVR EPIC"
            className="h-14 w-14 rounded-full object-cover sm:h-16 sm:w-16"
          />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/45">
              Latest from DSCOVR EPIC
            </div>
            <div className="font-mono text-xs text-white/85">
              {epic?.date ? formatDate(epic.date) : ""}
            </div>
            <div className="mt-0.5 text-[11px] text-sky-300/80">View full image →</div>
          </div>
        </button>
      )}

      {/* Selected event detail */}
      {selected && (
        <div className="pointer-events-auto absolute bottom-5 right-5 w-[280px] rounded-2xl border border-white/10 bg-[#070b16]/85 p-4 backdrop-blur-md sm:bottom-7 sm:right-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selected.color, boxShadow: `0 0 8px ${selected.color}` }}
              />
              <span className="text-[10px] uppercase tracking-widest text-white/50">
                {selected.category}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="-mr-1 -mt-1 rounded-md px-1.5 text-white/40 transition hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <h2 className="mt-2 text-sm font-medium leading-snug text-white">
            {selected.title}
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Open in NASA EONET
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/55">
            Last observed {formatDate(selected.date)}
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-white/40">
            Stays listed until NASA closes it — the date is the most recent
            satellite observation, not necessarily today.
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-white/40">
            {selected.lat.toFixed(2)}°, {selected.lng.toFixed(2)}°
          </p>

          {/* Real satellite view of the event area (NASA GIBS), links into Worldview. */}
          <a
            href={worldviewUrl(selected.lat, selected.lng, selected.date)}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-3 block overflow-hidden rounded-lg ring-1 ring-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={selected.id}
              src={gibsSnapshotUrl(selected.lat, selected.lng, selected.date, selected.categoryId)}
              alt={`Satellite view of ${selected.title}`}
              className="aspect-square w-full bg-white/5 object-cover transition group-hover:opacity-90"
            />
            <div className="flex items-center justify-between px-2 py-1 text-[10px] text-white/45">
              <span>Satellite view · NASA GIBS</span>
              <span className="text-sky-300/80 group-hover:text-sky-200">Worldview →</span>
            </div>
          </a>

          {selected.link && (
            <a
              href={selected.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-sky-300 hover:text-sky-200"
            >
              Source data →
            </a>
          )}
        </div>
      )}

      {/* Country profile panel */}
      {country && (
        <div className="scroll-thin pointer-events-auto absolute right-5 top-5 max-h-[calc(100%-2.5rem)] w-[300px] overflow-y-auto rounded-2xl border border-white/10 bg-[#070b16]/90 p-4 backdrop-blur-md sm:right-7 sm:top-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {country.alpha2 && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://flags.restcountries.com/v5/w160/${country.alpha2.toLowerCase()}.png`}
                  alt={`${country.name} flag`}
                  className="h-8 w-auto rounded-sm ring-1 ring-white/15"
                />
              )}
              <div>
                <h2 className="text-base font-semibold leading-tight text-white">
                  {country.name}
                </h2>
                {country.official && country.official !== country.name && (
                  <p className="text-[11px] leading-tight text-white/45">{country.official}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setCountry(null)}
              className="-mr-1 -mt-1 rounded-md px-1.5 text-white/40 transition hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <dl className="mt-4 space-y-2 text-xs">
            <Row label="Capital" value={country.capital} />
            <Row
              label="Population"
              value={country.population ? country.population.toLocaleString() : null}
            />
            <Row
              label="Area"
              value={country.areaKm ? `${compactNumber(country.areaKm)} km²` : null}
            />
            <Row
              label="Region"
              value={[country.subregion, country.region].filter(Boolean).join(" · ") || null}
            />
            <Row label="Government" value={country.governmentType} />
            <Row label="Currencies" value={country.currencies.join(", ") || null} />
            <Row label="Languages" value={country.languages.join(", ") || null} />
            <Row
              label="Calling code"
              value={country.callingCodes.length ? `+${country.callingCodes.join(", +")}` : null}
            />
            <Row label="Timezones" value={country.timezones.join(", ") || null} />
            <Row
              label="Drives on"
              value={country.drivingSide ? `${country.drivingSide} side` : null}
            />
            <Row label="Internet" value={country.tlds.join(", ") || null} />
          </dl>

          {country.memberships.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {country.memberships.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-200"
                >
                  {MEMBERSHIP_LABELS[m] ?? m}
                </span>
              ))}
            </div>
          )}

          {country.wikipedia && (
            <a
              href={country.wikipedia}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-xs text-sky-300 hover:text-sky-200"
            >
              Wikipedia →
            </a>
          )}
        </div>
      )}

      {/* EPIC full-image lightbox */}
      {epicOpen && epicFrame && (
        <div
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setEpicOpen(false)}
        >
          <div
            className="flex max-h-full max-w-3xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={epicFrame.src}
              alt="Full-disc image of Earth from DSCOVR EPIC"
              className="max-h-[70vh] rounded-xl object-contain shadow-2xl"
            />
            <p className="scroll-thin mt-4 max-w-xl overflow-y-auto text-center text-xs leading-relaxed text-white/70">
              {epicFrame.caption}
            </p>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              {epic?.date ? formatDate(epic.date) : ""} · NASA DSCOVR EPIC
            </p>
            <button
              onClick={() => setEpicOpen(false)}
              className="mt-4 rounded-full border border-white/20 px-4 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rotation play/pause */}
      <button
        onClick={() => setRotating((r) => !r)}
        aria-label={rotating ? "Pause globe rotation" : "Resume globe rotation"}
        title={rotating ? "Pause rotation" : "Resume rotation"}
        className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white/70 backdrop-blur-md transition hover:bg-white/10"
      >
        {rotating ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <rect x="2" y="1.5" width="3" height="9" rx="1" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M3 1.8v8.4a.6.6 0 0 0 .92.5l6.5-4.2a.6.6 0 0 0 0-1l-6.5-4.2A.6.6 0 0 0 3 1.8Z" />
          </svg>
        )}
        {rotating ? "Pause" : "Rotate"}
      </button>

      {/* Attribution */}
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-white/25">
        Data: NASA EONET + REST Countries · Imagery: NASA DSCOVR EPIC + Blue Marble
      </div>

      {/* Loading / error overlays */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070f]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-sky-400" />
            <p className="mt-4 font-mono text-xs tracking-widest text-white/50">
              ESTABLISHING ORBIT…
            </p>
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070f] p-6">
          <div className="max-w-sm text-center">
            <p className="text-sm text-white/80">{error}</p>
            <p className="mt-2 text-xs text-white/45">
              NASA&apos;s services may be rate-limiting the demo key. Add a free key to{" "}
              <span className="font-mono">.env.local</span> and reload.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className="text-right text-white/85">{value}</dd>
    </div>
  );
}
