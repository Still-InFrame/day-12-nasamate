// Server-side NASA key access + shared shapes for the Spaceship Earth experience.
// The key is read from the environment only; it never reaches the client. EONET
// and the bundled Blue Marble texture need no key at all — only EPIC does.

export const NASA_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

// EONET groups every event under a category; we color pins by it so the globe
// reads at a glance (fire = ember, storms = blue, ice = cyan, ...).
export const CATEGORY_COLORS: Record<string, string> = {
  wildfires: "#ff5a36",
  severeStorms: "#4aa3ff",
  volcanoes: "#ff3b3b",
  seaLakeIce: "#7fe3ff",
  earthquakes: "#ffd23b",
  floods: "#3b6bff",
  drought: "#e0b34a",
  dustHaze: "#c79a6b",
  snow: "#e8f4ff",
  waterColor: "#2bd4a8",
  manmade: "#b06bff",
  landslides: "#a0744a",
  tempExtremes: "#ff7b00",
};
export const DEFAULT_COLOR = "#cfd8ff";

export type EonetEvent = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  color: string;
  lat: number;
  lng: number;
  date: string;
  link: string;
};

export type EpicFrame = {
  name: string;
  caption: string;
  date: string;
  src: string;
};

export type EpicResponse = {
  date: string | null;
  caption: string | null;
  frames: EpicFrame[];
};

// Categories where a thermal-anomaly overlay actually adds something.
const FIRE_CATEGORIES = new Set(["wildfires", "volcanoes"]);

// Build a NASA GIBS / Worldview Snapshot URL: real satellite imagery of a
// bounding box around an event, on the event's date. Keyless. True-color base,
// plus a VIIRS thermal-anomaly overlay for fire-like events so hotspots show.
export function gibsSnapshotUrl(
  lat: number,
  lng: number,
  dateISO: string,
  categoryId: string,
): string {
  const date = dateISO.slice(0, 10);
  const pad = 3; // ~6° window around the event
  const minLat = Math.max(-90, lat - pad);
  const maxLat = Math.min(90, lat + pad);
  const minLng = Math.max(-180, lng - pad);
  const maxLng = Math.min(180, lng + pad);
  const layers = FIRE_CATEGORIES.has(categoryId)
    ? "MODIS_Terra_CorrectedReflectance_TrueColor,VIIRS_SNPP_Thermal_Anomalies_375m_All"
    : "MODIS_Terra_CorrectedReflectance_TrueColor";
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=${date}&BBOX=${bbox}&CRS=EPSG:4326&LAYERS=${layers}&FORMAT=image/jpeg&WIDTH=512&HEIGHT=512`;
}

// Deep link into the full interactive Worldview viewer at the same spot/date.
export function worldviewUrl(lat: number, lng: number, dateISO: string): string {
  const date = dateISO.slice(0, 10);
  const pad = 3;
  const west = Math.max(-180, lng - pad);
  const south = Math.max(-90, lat - pad);
  const east = Math.min(180, lng + pad);
  const north = Math.min(90, lat + pad);
  return `https://worldview.earthdata.nasa.gov/?v=${west},${south},${east},${north}&t=${date}`;
}
