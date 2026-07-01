export type PlaceSelection = {
  label: string;
  city: string;
  state: string | null;
  marinaName?: string;
};

export function parsePlaceLocation(
  place: google.maps.places.PlaceResult
): PlaceSelection | null {
  const components = place.address_components;
  if (!components?.length) {
    const fallback = place.formatted_address || place.name || "";
    if (!fallback.trim()) return null;
    return { label: fallback, city: fallback.trim(), state: null };
  }

  let city = "";
  let state = "";
  let sublocality = "";

  for (const part of components) {
    if (part.types.includes("locality")) {
      city = part.long_name;
    } else if (part.types.includes("administrative_area_level_1")) {
      state = part.short_name;
    } else if (
      part.types.includes("sublocality") ||
      part.types.includes("sublocality_level_1")
    ) {
      sublocality = part.long_name;
    } else if (part.types.includes("administrative_area_level_2") && !city) {
      city = part.long_name;
    }
  }

  const resolvedCity = city || sublocality || place.name || "";
  if (!resolvedCity) return null;

  const label = state ? `${resolvedCity}, ${state}` : resolvedCity;
  return {
    label,
    city: resolvedCity,
    state: state || null,
  };
}

export function parseMarinaPlace(
  place: google.maps.places.PlaceResult
): PlaceSelection | null {
  const parsed = parsePlaceLocation(place);
  if (!parsed) return null;
  const marinaName = place.name?.trim();
  return {
    ...parsed,
    label: marinaName || parsed.label,
    marinaName: marinaName || undefined,
  };
}

/** Fallback when the user types a location without picking a suggestion. */
export function parseManualLocation(text: string): PlaceSelection | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[0];
    const state = parts[parts.length - 1];
    return { label: `${city}, ${state}`, city, state };
  }
  return { label: trimmed, city: trimmed, state: null };
}
