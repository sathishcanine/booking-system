import { Loader } from "@googlemaps/js-api-loader";

let loadPromise: Promise<typeof google> | null = null;

export function getMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
}

export function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not configured"));
  }
  if (!loadPromise) {
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });
    loadPromise = loader.load();
  }
  return loadPromise;
}
