import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";

/**
 * Breadcrumb navigation trail.
 *
 * @param {{ label: string, to?: string }[]} items
 *   The last item is rendered as plain text (current page).
 */
export default function Breadcrumbs({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mb-6 flex-wrap"
      data-testid="breadcrumbs"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <CaretRight size={10} className="text-slate-300" />
            )}
            {isLast || !item.to ? (
              <span className="text-slate-900 font-semibold truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="hover:text-sky-600 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
