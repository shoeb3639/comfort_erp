import { LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchReportingPlaces } from "../services/cities";

export default function AddressAutocomplete({ value, onChange, city }) {
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [providerAvailable, setProviderAvailable] = useState(true);

  useEffect(() => {
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 3) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchReportingPlaces({
          query,
          latitude: city?.latitude ?? undefined,
          longitude: city?.longitude ?? undefined,
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestId !== requestRef.current)
          return;
        setItems(result.items || []);
        setProviderAvailable(result.providerAvailable !== false);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setProviderAvailable(false);
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestRef.current)
          setLoading(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, open, city?.latitude, city?.longitude]);

  return (
    <div className="relative mt-1" ref={rootRef}>
      <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <MapPin className="ml-3 shrink-0 text-slate-400" size={16} />
        <input
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none"
          value={value}
          placeholder="Search locality or enter full address"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
        />
        {loading && (
          <LoaderCircle
            className="mr-3 animate-spin text-brand-500"
            size={16}
          />
        )}
      </div>
      {open && value.trim().length >= 3 && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((place) => (
            <button
              key={place.id}
              type="button"
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50"
              onClick={() => {
                onChange(place.displayName);
                setOpen(false);
              }}
            >
              {place.displayName}
            </button>
          ))}
          {!loading && items.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-slate-500">
              {providerAvailable
                ? "No suggestion found. Your typed address will be saved."
                : "Suggestions unavailable. Your typed address will still be saved."}
            </p>
          )}
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
            Search by{" "}
            <a
              className="underline"
              href="https://locationiq.com"
              target="_blank"
              rel="noreferrer"
            >
              LocationIQ.com
            </a>{" "}
            · You can always enter the full address manually.
          </p>
        </div>
      )}
    </div>
  );
}
