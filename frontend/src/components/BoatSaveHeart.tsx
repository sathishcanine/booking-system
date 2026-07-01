import { useSavedBoats } from "../hooks/useSavedBoats";

type Props = {
  activityId: number;
  returnPath?: string;
};

export default function BoatSaveHeart({ activityId, returnPath }: Props) {
  const { isSaved, toggleSave, busyId } = useSavedBoats();
  const saved = isSaved(activityId);
  const busy = busyId === activityId;

  return (
    <button
      type="button"
      className={`boat-save-heart${saved ? " boat-save-heart--saved" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleSave(activityId, returnPath);
      }}
      disabled={busy}
      aria-label={saved ? "Remove from saved boats" : "Save boat"}
      aria-pressed={saved}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
