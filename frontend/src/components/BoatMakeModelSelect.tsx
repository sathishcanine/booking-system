import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  options: string[];
  topOptions?: string[];
  topSectionLabel?: string;
  allSectionLabel?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

function filterOptions(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.toLowerCase().includes(q));
}

export default function BoatMakeModelSelect({
  label,
  value,
  options,
  topOptions,
  topSectionLabel = "Top makes",
  allSectionLabel = "All",
  onChange,
  required,
  disabled,
  placeholder,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updateMenuPosition = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value]);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const filteredTop = useMemo(() => {
    if (!topOptions?.length) return [];
    const topSet = new Set(topOptions);
    return filterOptions(options, query).filter((o) => topSet.has(o));
  }, [options, query, topOptions]);
  const filteredRest = useMemo(() => {
    const topSet = new Set(filteredTop);
    return filtered.filter((o) => !topSet.has(o));
  }, [filtered, filteredTop]);

  function pick(option: string) {
    onChange(option);
    setQuery(option);
    setOpen(false);
  }

  function commitQuery() {
    const trimmed = query.trim();
    if (trimmed) {
      onChange(trimmed);
      setQuery(trimmed);
    } else {
      setQuery(value);
    }
    setOpen(false);
  }

  return (
    <div
      className={`admin-field boat-mm-select${open ? " boat-mm-select--open" : ""}${disabled ? " boat-mm-select--disabled" : ""}`}
      ref={wrapRef}
    >
      <label htmlFor={listId}>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="boat-mm-select-control">
        <input
          id={listId}
          ref={inputRef}
          type="text"
          className="boat-mm-select-input"
          value={query}
          disabled={disabled}
          required={required && !disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            if (!disabled) {
              updateMenuPosition();
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitQuery();
            }
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(value);
            }
          }}
          onBlur={() => {
            window.setTimeout(commitQuery, 120);
          }}
        />
        <span className="boat-mm-select-chevron" aria-hidden>
          ▾
        </span>
      </div>
      {open && !disabled && (
        <div
          className="boat-mm-select-menu"
          role="listbox"
          style={{
            position: "fixed",
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
          }}
        >
          {filteredTop.length > 0 && (
            <>
              <p className="boat-mm-select-section">{topSectionLabel}</p>
              {filteredTop.map((option) => (
                <button
                  key={`top-${option}`}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={`boat-mm-select-option${option === value ? " boat-mm-select-option--active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {option}
                </button>
              ))}
            </>
          )}
          {filteredRest.length > 0 && (
            <>
              <p className="boat-mm-select-section">{filteredTop.length ? allSectionLabel : "Options"}</p>
              {filteredRest.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={`boat-mm-select-option${option === value ? " boat-mm-select-option--active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {option}
                </button>
              ))}
            </>
          )}
          {query.trim() &&
            !filtered.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                className="boat-mm-select-option boat-mm-select-option--custom"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(query.trim())}
              >
                Use &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          {filtered.length === 0 && !query.trim() && (
            <p className="boat-mm-select-empty">Type to search or enter a value</p>
          )}
        </div>
      )}
    </div>
  );
}
