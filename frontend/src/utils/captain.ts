import type { CaptainPref } from "../api";

type BoatCaptainRules = {
  captain_required: boolean;
  bareboat_allowed: boolean;
};

export type CaptainSelectionState = {
  captainIncluded: boolean;
  captainedDisabled: boolean;
  bareboatDisabled: boolean;
  showToggle: boolean;
};

export function resolveCaptainSelection(
  boat: BoatCaptainRules,
  _captainPref?: CaptainPref | null
): CaptainSelectionState {
  if (boat.captain_required) {
    return {
      captainIncluded: true,
      captainedDisabled: false,
      bareboatDisabled: true,
      showToggle: false,
    };
  }
  if (!boat.bareboat_allowed) {
    return {
      captainIncluded: true,
      captainedDisabled: false,
      bareboatDisabled: true,
      showToggle: false,
    };
  }
  // Admin "No captain" mode — bareboat only; captained is not available.
  return {
    captainIncluded: false,
    captainedDisabled: true,
    bareboatDisabled: false,
    showToggle: true,
  };
}
