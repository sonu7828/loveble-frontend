import { useState } from "react";

// San Mateo has been retired client-side; San Jose is the only public-facing
// studio. Kept LocationKey + LOCATIONS shape to preserve call sites.
export type LocationKey = "san-jose";

export const LOCATIONS: Record<LocationKey, {
  id: string;
  key: LocationKey;
  name: string;
  shortName: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
}> = {
  "san-jose": {
    id: "11111111-1111-1111-1111-111111111111",
    key: "san-jose",
    name: "San Jose Studio",
    shortName: "San Jose",
    city: "San Jose",
    address: "2100 Curtner Ave, Ste 1B",
    lat: 37.2627,
    lng: -121.9156,
  },
};

const STORAGE_KEY = "rka_pref_location";

export function usePreferredLocation() {
  const [pref] = useState<LocationKey>("san-jose");
  try { localStorage.setItem(STORAGE_KEY, "san-jose"); } catch {}

  const choose = (_key: LocationKey) => { /* single-location, no-op */ };

  return {
    pref,
    autoDetected: false,
    location: LOCATIONS["san-jose"],
    choose,
  };
}

