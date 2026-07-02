"""Captain profile field options — license, experience, specializations."""

CAPTAIN_LICENSE_TYPES = [
    {"id": "uscg_master", "label": "USCG Master"},
    {"id": "oupv_6_pack", "label": "OUPV (6-Pack)"},
]

CAPTAIN_EXPERIENCE_OPTIONS = [
    {"id": "15_plus", "label": "15+ Years"},
    {"id": "10_15", "label": "10-15 Years"},
    {"id": "5_10", "label": "5-10 Years"},
]

CAPTAIN_SPECIALIZATIONS = [
    {"id": "fishing", "label": "Fishing"},
    {"id": "sunset_tours", "label": "Sunset Tours"},
    {"id": "island_hopping", "label": "Island Hopping"},
    {"id": "ecological", "label": "Ecological"},
]

VALID_LICENSE_IDS = frozenset(item["id"] for item in CAPTAIN_LICENSE_TYPES)
VALID_EXPERIENCE_IDS = frozenset(item["id"] for item in CAPTAIN_EXPERIENCE_OPTIONS)
VALID_SPECIALIZATION_IDS = frozenset(item["id"] for item in CAPTAIN_SPECIALIZATIONS)


def label_for_experience(experience_id: str | None) -> str | None:
    if not experience_id:
        return None
    for item in CAPTAIN_EXPERIENCE_OPTIONS:
        if item["id"] == experience_id:
            return item["label"]
    return None


def labels_for_ids(ids: list[str], catalog: list[dict[str, str]]) -> list[str]:
    by_id = {item["id"]: item["label"] for item in catalog}
    return [by_id[item_id] for item_id in ids if item_id in by_id]
