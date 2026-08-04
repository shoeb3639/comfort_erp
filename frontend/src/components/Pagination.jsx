const sizes = [10, 25, 50, 100];

export default function Pagination({
  pagination,
  onPageChange,
  onLimitChange,
}) {
  if (!pagination) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {pagination.page} of {pagination.pages} · {pagination.total}{" "}
        records
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            value={pagination.limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          disabled={!pagination.hasPrevious}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
