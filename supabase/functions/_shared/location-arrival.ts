// Location-specific address + arrival instructions for client booking emails.
// Returned strings are plain text; templates render with whiteSpace: 'pre-line'.

export type LocationArrival = {
  address: string;
  instructions: string;
};

function normalizeCity(city?: string | null): "san_jose" | "san_mateo" | null {
  const c = (city ?? "").toLowerCase().trim();
  if (c.includes("jose")) return "san_jose";
  if (c.includes("mateo")) return "san_mateo";
  return null;
}

export function getLocationArrival(args: {
  city?: string | null;
  name?: string | null;
  address?: string | null;
  state?: string | null;
}): LocationArrival {
  const key = normalizeCity(args.city) ?? (() => {
    const n = (args.name ?? "").toLowerCase();
    if (n.includes("jose")) return "san_jose";
    if (n.includes("mateo")) return "san_mateo";
    return null;
  })();

  if (key === "san_jose") {
    return {
      address:
        "2100 Curtner Ave, Ste 1B, San Jose, CA 95124 (Inside ABDO building)",
      instructions:
        "When you walk in from the main parking lot, turn to your left — you will see Suite B. Come in and the clinic is right at the front.",
    };
  }
  if (key === "san_mateo") {
    return {
      address:
        "1528 S El Camino Real, Ste 200, San Mateo, CA (Inside Hot Yoga Plus studio)",
      instructions:
        "Enter the main building through the back side where the parking lot is. Building code: #0200.\n" +
        "Note: the main lobby doors automatically lock during late evenings every day.\n" +
        "If you park in the underground garage, the access code is 7549. Please do not park in any spot labeled \"RESERVED\" — your car will be towed.\n" +
        "Bathroom door code: 542#.\n" +
        "When you reach the Hot Yoga Plus door, please text or call: 408-351-1873.",
    };
  }

  // Fallback to whatever was in the DB
  const parts = [args.address, args.city, args.state].filter(Boolean);
  return {
    address: parts.join(", "),
    instructions: "",
  };
}
