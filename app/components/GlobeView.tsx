"use client";

import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { EonetEvent } from "@/lib/nasa";
import type { Country } from "@/lib/countries";

// This whole file is the client-only WebGL boundary. The page imports it with
// next/dynamic({ ssr: false }), so react-globe.gl (which touches `window`)
// never runs on the server. Keeping the static `import Globe` here — rather
// than dynamic-importing the library directly — lets us hold a real ref to set
// camera controls, which next/dynamic does not forward.

// A world-atlas polygon feature with our country data joined onto it.
export type CountryFeature = {
  properties: { name: string; country: Country | null };
  [key: string]: unknown;
};

type Props = {
  events: EonetEvent[];
  countries: CountryFeature[];
  onEventClick: (e: EonetEvent) => void;
  onCountryClick: (c: Country) => void;
  focus: EonetEvent | null;
  selectedCountry: Country | null;
  rotating: boolean;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export default function GlobeView({
  events,
  countries,
  onEventClick,
  onCountryClick,
  focus,
  selectedCountry,
  rotating,
}: Props) {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<CountryFeature | null>(null);
  const [hoveringPin, setHoveringPin] = useState(false);

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // One-time camera setup: gentle auto-rotate, locked panning, sane zoom range.
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotateSpeed = 0.35;
    controls.enablePan = false;
    controls.minDistance = 180;
    controls.maxDistance = 600;
    g.pointOfView({ altitude: 2.5 }, 0);
  }, []);

  // Effective rotation = the user's intent (play/pause button) minus any
  // transient hover pause. Hovering an event pin freezes the globe so it
  // doesn't drift out from under the cursor; leaving resumes if the user
  // still wants rotation.
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    g.controls().autoRotate = rotating && !hoveringPin;
  }, [rotating, hoveringPin]);

  // Fly the camera to the selected event.
  useEffect(() => {
    const g = globeEl.current;
    if (!g || !focus) return;
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.6 }, 1200);
  }, [focus]);

  // Fly the camera to the selected country's centroid.
  useEffect(() => {
    const g = globeEl.current;
    if (!g || !selectedCountry?.lat || !selectedCountry?.lng) return;
    g.pointOfView({ lat: selectedCountry.lat, lng: selectedCountry.lng, altitude: 1.6 }, 1200);
  }, [selectedCountry]);

  const isHot = (d: CountryFeature) =>
    d === hover ||
    (selectedCountry != null && d.properties.country?.ccn3 === selectedCountry.ccn3);

  return (
    <Globe
      ref={globeEl}
      width={dims.w}
      height={dims.h}
      globeImageUrl="/textures/earth-blue-marble.jpg"
      bumpImageUrl="/textures/earth-topology.png"
      backgroundImageUrl="/textures/night-sky.png"
      showAtmosphere
      atmosphereColor="#5aa9ff"
      atmosphereAltitude={0.2}
      // Country layer — subtle outlines always on; a country lifts + tints on
      // hover/select so the Blue Marble imagery stays visible underneath.
      polygonsData={countries}
      // Unselected countries lie flush with transparent caps/sides so the Blue
      // Marble shows through — only thin border strokes hint at them. The hovered
      // or selected country lifts and tints to read as "active". The lift is kept
      // BELOW the event-pin altitude (0.06) so a raised country never rises above
      // a pin and steals its click via the raycaster.
      polygonAltitude={(d) => (isHot(d as CountryFeature) ? 0.025 : 0.001)}
      polygonCapColor={(d) =>
        isHot(d as CountryFeature) ? "rgba(90,169,255,0.5)" : "rgba(255,255,255,0)"
      }
      polygonSideColor={(d) =>
        isHot(d as CountryFeature) ? "rgba(90,169,255,0.25)" : "rgba(255,255,255,0)"
      }
      polygonStrokeColor={() => "rgba(255,255,255,0.22)"}
      polygonLabel={(d) => {
        const c = (d as CountryFeature).properties;
        return `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;color:#fff;background:rgba(8,12,24,0.85);border:1px solid rgba(255,255,255,0.15);padding:5px 9px;border-radius:8px;backdrop-filter:blur(4px)">${c.country?.flagEmoji ?? ""} ${c.name}</div>`;
      }}
      onPolygonHover={(d) => setHover((d as CountryFeature) ?? null)}
      onPolygonClick={(d) => {
        const c = (d as CountryFeature).properties.country;
        if (c) onCountryClick(c);
      }}
      polygonsTransitionDuration={250}
      // Event layer — sits above the polygons.
      pointsData={events}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.06}
      pointRadius={0.45}
      pointsMerge={false}
      pointLabel={(d) => {
        const e = d as EonetEvent;
        return `<div style="font-family:ui-sans-serif,system-ui;font-size:12px;color:#fff;background:rgba(8,12,24,0.85);border:1px solid rgba(255,255,255,0.15);padding:6px 9px;border-radius:8px;max-width:220px;backdrop-filter:blur(4px)"><div style="font-weight:600">${e.title}</div><div style="opacity:0.6;font-size:11px;margin-top:2px">${e.category}</div></div>`;
      }}
      onPointClick={(d) => onEventClick(d as EonetEvent)}
      onPointHover={(pt) => setHoveringPin(Boolean(pt))}
      // A single pulsing ring marks the selected event (cheap; only one at a time).
      ringsData={focus ? [focus] : []}
      ringLat="lat"
      ringLng="lng"
      ringMaxRadius={4}
      ringPropagationSpeed={1.4}
      ringRepeatPeriod={1300}
      ringColor={() => {
        const [r, g, b] = hexToRgb(focus?.color ?? "#ffffff");
        return (t: number) => `rgba(${r},${g},${b},${1 - t})`;
      }}
    />
  );
}
