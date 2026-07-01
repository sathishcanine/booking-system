import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "../lib/googleMaps";
import {
  parseMarinaPlace,
  parsePlaceLocation,
  type PlaceSelection,
} from "../utils/placeLocation";

type PlaceMode = "city" | "marina";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  mode?: PlaceMode;
};

export default function PlacesAutocompleteInput({
  id,
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
  disabled,
  mode = "city",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
    onChangeRef.current = onChange;
  }, [onPlaceSelect, onChange]);

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !inputRef.current) return;

        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          ...(mode === "city" ? { types: ["(cities)"] } : {}),
          componentRestrictions: { country: "us" },
          fields: ["address_components", "formatted_address", "name"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          if (!place) return;
          const parsed =
            mode === "marina" ? parseMarinaPlace(place) : parsePlaceLocation(place);
          if (!parsed) return;
          const display =
            mode === "marina" ? parsed.marinaName || parsed.label : parsed.label;
          onChangeRef.current(display);
          onPlaceSelectRef.current?.(parsed);
        });
      })
      .catch(() => {
        /* Falls back to plain text search when Maps is unavailable */
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [mode]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="search"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      disabled={disabled}
    />
  );
}
