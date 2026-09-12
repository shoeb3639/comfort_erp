import { ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export default function AsyncAutocomplete({
  value,
  selectedOption,
  onChange,
  loadOptions,
  disabled = false,
  placeholder = "Search…",
  emptyMessage = "No matching records found.",
  recentLabel = "Recently used",
  minChars = 2,
  debounceMs = 350,
  getOptionLabel = (option) => option.displayName || option.name,
  renderOption,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  async function requestOptions(nextQuery, nextPage, append, signal) {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await loadOptions({
        query: nextQuery,
        page: nextPage,
        signal,
      });
      if (signal.aborted || requestId !== requestRef.current) return;
      setItems((current) =>
        append ? [...current, ...result.items] : result.items,
      );
      setPage(nextPage);
      setHasNext(Boolean(result.pagination?.hasNext));
      setActiveIndex(-1);
    } catch (requestError) {
      if (signal.aborted) return;
      setError(
        requestError?.response?.data?.message || "Unable to load options.",
      );
    } finally {
      if (!signal.aborted && requestId === requestRef.current)
        setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || disabled) return undefined;
    const trimmed = query.trim();
    if (trimmed && trimmed.length < minChars) {
      setItems([]);
      setHasNext(false);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => requestOptions(trimmed, 1, false, controller.signal),
      trimmed ? debounceMs : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, disabled, loadOptions, minChars, debounceMs]);

  useEffect(() => {
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(option) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") return setOpen(false);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      choose(items[activeIndex]);
    }
  }

  const showQueryHint =
    query.trim().length > 0 && query.trim().length < minChars;
  return (
    <div className="relative mt-1" ref={rootRef}>
      <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <Search className="ml-3 shrink-0 text-slate-400" size={16} />
        <input
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          disabled={disabled}
          value={
            open ? query : selectedOption ? getOptionLabel(selectedOption) : ""
          }
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <LoaderCircle
            className="mr-2 animate-spin text-brand-500"
            size={16}
          />
        )}
        {value && !disabled ? (
          <button
            type="button"
            className="mr-2 text-slate-400 hover:text-slate-700"
            aria-label="Clear selection"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(true);
            }}
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown className="mr-3 text-slate-400" size={16} />
        )}
      </div>
      {open && !disabled && (
        <div
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {!query.trim() && items.length > 0 && (
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {recentLabel}
            </p>
          )}
          {showQueryHint && (
            <p className="px-3 py-3 text-sm text-slate-500">
              Enter at least {minChars} characters.
            </p>
          )}
          {!showQueryHint && !loading && !error && items.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</p>
          )}
          {error && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-rose-700">
              <span>{error}</span>
              <button
                type="button"
                className="font-semibold"
                onClick={() => {
                  const controller = new AbortController();
                  requestOptions(query.trim(), 1, false, controller.signal);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {items.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${index === activeIndex || option.id === value ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              {renderOption ? renderOption(option) : getOptionLabel(option)}
            </button>
          ))}
          {hasNext && (
            <button
              type="button"
              disabled={loading}
              className="w-full rounded-md px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
              onClick={() => {
                const controller = new AbortController();
                requestOptions(query.trim(), page + 1, true, controller.signal);
              }}
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
