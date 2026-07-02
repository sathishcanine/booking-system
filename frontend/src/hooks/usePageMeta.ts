import { useEffect } from "react";

const SITE = "AlisAdventure";
const DEFAULT_DESCRIPTION =
  "Boat rentals, captain-led trips, and on-the-water experiences — browse, book, boat.";

type PageMeta = {
  title?: string;
  description?: string;
};

export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | ${SITE}` : SITE;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const prevDescription = meta.content;
    meta.content = description || DEFAULT_DESCRIPTION;

    return () => {
      document.title = prevTitle;
      if (created && meta?.parentNode) {
        meta.parentNode.removeChild(meta);
      } else if (meta) {
        meta.content = prevDescription;
      }
    };
  }, [title, description]);
}
