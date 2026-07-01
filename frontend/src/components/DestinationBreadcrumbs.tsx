import { Link } from "react-router-dom";
import type { Breadcrumb } from "../api";

type Props = {
  items: Breadcrumb[];
};

export default function DestinationBreadcrumbs({ items }: Props) {
  return (
    <nav className="dest-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="dest-breadcrumb-item">
          {i > 0 && <span className="dest-breadcrumb-sep" aria-hidden> &gt; </span>}
          {item.href ? (
            <Link to={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
