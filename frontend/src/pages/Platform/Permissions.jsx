import { useEffect, useMemo, useState } from "react";
import {
  getPlatformErrorMessage,
  getPlatformPermissions,
} from "../../services/platform";

export default function PlatformPermissionsPage() {
  const [permissions, setPermissions] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPlatformPermissions()
      .then(setPermissions)
      .catch((requestError) => setError(getPlatformErrorMessage(requestError)));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((permission) =>
      [
        permission.module,
        permission.action,
        permission.permissionKey,
        permission.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [permissions, search]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Platform-managed permission catalog used for tenant roles and API access.
        </p>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search permissions"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-72"
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Module</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Permission key</th><th className="px-4 py-3">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((permission) => (
                <tr key={permission.id}><td className="px-4 py-3 font-medium">{permission.module}</td><td className="px-4 py-3">{permission.action}</td><td className="px-4 py-3 font-mono text-xs">{permission.permissionKey}</td><td className="px-4 py-3 text-slate-600">{permission.description || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
