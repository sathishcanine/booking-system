export const CAPTAIN_LICENSE_TYPES = [
  { id: "uscg_master", label: "USCG Master" },
  { id: "oupv_6_pack", label: "OUPV (6-Pack)" },
] as const;

export const CAPTAIN_EXPERIENCE_OPTIONS = [
  { id: "15_plus", label: "15+ Years" },
  { id: "10_15", label: "10-15 Years" },
  { id: "5_10", label: "5-10 Years" },
] as const;

export const CAPTAIN_SPECIALIZATIONS = [
  { id: "fishing", label: "Fishing" },
  { id: "sunset_tours", label: "Sunset Tours" },
  { id: "island_hopping", label: "Island Hopping" },
  { id: "ecological", label: "Ecological" },
] as const;

export type CaptainLicenseTypeId = (typeof CAPTAIN_LICENSE_TYPES)[number]["id"];
export type CaptainExperienceId = (typeof CAPTAIN_EXPERIENCE_OPTIONS)[number]["id"];
export type CaptainSpecializationId = (typeof CAPTAIN_SPECIALIZATIONS)[number]["id"];

const experienceById = Object.fromEntries(
  CAPTAIN_EXPERIENCE_OPTIONS.map((item) => [item.id, item.label])
) as Record<CaptainExperienceId, string>;

const licenseById = Object.fromEntries(
  CAPTAIN_LICENSE_TYPES.map((item) => [item.id, item.label])
) as Record<CaptainLicenseTypeId, string>;

const specializationById = Object.fromEntries(
  CAPTAIN_SPECIALIZATIONS.map((item) => [item.id, item.label])
) as Record<CaptainSpecializationId, string>;

export function captainExperienceLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return experienceById[id as CaptainExperienceId] ?? null;
}

export function captainLicenseLabels(ids: string[]): string[] {
  return ids.map((id) => licenseById[id as CaptainLicenseTypeId]).filter(Boolean);
}

export function captainSpecializationLabels(ids: string[]): string[] {
  return ids.map((id) => specializationById[id as CaptainSpecializationId]).filter(Boolean);
}
