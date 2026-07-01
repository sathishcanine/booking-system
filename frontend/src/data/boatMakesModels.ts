export const TOP_BOAT_MAKES = [
  "Bayliner",
  "Beneteau USA",
  "Catalina",
  "Sea Ray",
  "Yamaha",
] as const;

export const ALL_BOAT_MAKES = [
  "Ab Inflatables",
  "Avalon",
  "Axopar",
  "Bayliner",
  "Beneteau USA",
  "Boston Whaler",
  "Catalina",
  "Chaparral",
  "Chris-Craft",
  "Cobalt",
  "Crownline",
  "Formula",
  "Four Winns",
  "Grady-White",
  "Harris",
  "Hurricane",
  "Jeanneau",
  "Key West",
  "Larson",
  "Malibu",
  "Mastercraft",
  "Monterey",
  "Nautique",
  "Pursuit",
  "Ranger",
  "Regal",
  "Robalo",
  "Sea Ray",
  "Sun Tracker",
  "Sunseeker",
  "Tahoe",
  "Yamaha",
] as const;

export const BOAT_MODELS_BY_MAKE: Record<string, string[]> = {
  Bayliner: [
    "D20",
    "D20i",
    "D22",
    "D22i",
    "Element E16",
    "Element E18",
    "Element E21",
    "M15",
    "M17",
    "VR4",
    "VR5",
    "VR6",
  ],
  "Beneteau USA": ["Antares 8", "Antares 9", "Flyer 7", "Flyer 8", "Gran Turismo 36"],
  Catalina: ["315", "355", "385", "425", "Capri 22", "Capri 26"],
  "Sea Ray": ["SPX 190", "SPX 210", "SDX 250", "SLX 260", "Sundancer 320", "Sundancer 370"],
  Yamaha: ["212X", "222X", "252X", "275 SD", "AR190", "AR210"],
  "Boston Whaler": ["130 Super Sport", "170 Montauk", "210 Montauk", "280 Outrage", "350 Outrage"],
  Chaparral: ["21 SSi", "23 SSi", "257 SSX", "287 SSX", "330 Signature"],
  Cobalt: ["R3", "R5", "R6", "R8", "A29", "A36"],
  "Grady-White": ["Freedom 235", "Freedom 275", "Fisherman 236", "Canyon 306"],
  Malibu: ["Wakesetter 21 LX", "Wakesetter 23 LSV", "Wakesetter 25 LSV"],
  Mastercraft: ["NXT20", "X22", "X24", "XStar"],
  Nautique: ["G21", "G23", "G25", "Super Air Nautique 210"],
  Monterey: ["218 SS", "238 SS", "268 SS", "328 SS"],
  Ranger: ["Z520L", "RT188P", "RT198P", "520 L"],
  Regal: ["1900 ES", "2100 ES", "2300 ES", "33 Express"],
};

export function modelsForMake(make: string): string[] {
  const key = make.trim();
  if (!key) return [];
  const exact = BOAT_MODELS_BY_MAKE[key];
  if (exact) return exact;
  const found = Object.entries(BOAT_MODELS_BY_MAKE).find(
    ([name]) => name.toLowerCase() === key.toLowerCase()
  );
  return found ? found[1] : [];
}
