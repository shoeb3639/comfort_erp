import { useEffect, useState } from "react";
import { Edit, Plus, Search, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import ActionNotice from "../../components/ActionNotice";
import Pagination from "../../components/Pagination";
import {
  createDriver,
  deleteDriver,
  listDrivers,
  updateDriver,
} from "../../services/drivers";
import { getVendors } from "../../services/vendors";
const empty = {
  engagementType: "OWN",
  vendorId: "",
  salutation: "",
  name: "",
  mobile: "",
  alternateMobile: "",
  licenceNumber: "",
  licenceType: "",
  licenceExpiry: "",
  address: "",
  status: "ACTIVE",
};
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
export default function DriversPage() {
  const { user } = useAuth();
  const canViewAccounts =
    user?.permissions?.includes("driver.view") &&
    user?.permissions?.includes("accounts.ledger.view");
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25 });
  async function load() {
    try {
      const [result, vendorResult] = await Promise.all([
        listDrivers({
          page: pagination.page,
          limit: pagination.limit,
          ...(tab ? { engagementType: tab } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        }),
        getVendors({ limit: 100 }),
      ]);
      setRecords(result.items);
      setPagination(result.pagination);
      setVendors(
        vendorResult.items.filter((v) => v.recordType !== "own_company"),
      );
    } catch (e) {
      setNotice({
        type: "error",
        message: e.response?.data?.message || "Unable to load drivers.",
      });
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [tab, search, pagination.page, pagination.limit]);
  const visible = records;
  async function save(e) {
    e.preventDefault();
    try {
      const payload = {
        engagementType: form.engagementType,
        vendorId: form.engagementType === "VENDOR" ? form.vendorId : null,
        salutation: form.salutation || null,
        name: form.name,
        mobile: form.mobile,
        alternateMobile: form.alternateMobile || null,
        licenceNumber: form.licenceNumber || null,
        licenceType: form.licenceType || null,
        licenceExpiry: form.licenceExpiry || null,
        address: form.address || null,
        status: form.status,
      };
      if (form.id) await updateDriver(form.id, payload);
      else await createDriver(payload);
      setForm(null);
      setNotice({
        type: "success",
        message: `Driver ${form.id ? "updated" : "created"} successfully.`,
      });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to save driver.",
      });
    }
  }
  async function remove(r) {
    if (!window.confirm(`Archive ${r.displayName || r.name}?`)) return;
    try {
      await deleteDriver(r.id);
      setNotice({ type: "success", message: "Driver archived successfully." });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to archive driver.",
      });
    }
  }
  return (
    <div className="space-y-5">
      {notice && <ActionNotice {...notice} onClose={() => setNotice(null)} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            ["", "All"],
            ["OWN", "Own Drivers"],
            ["VENDOR", "Vendor Drivers"],
          ].map(([v, l]) => (
            <button
              key={l}
              onClick={() => {
                setTab(v);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === v ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setForm({ ...empty })}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={17} /> Add Driver
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input
          className={`${field} pl-10`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((current) => ({ ...current, page: 1 }));
          }}
          placeholder="Search name, mobile or licence"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            {
              <tr>
                {[
                  "Driver",
                  "Mobile",
                  "Licence",
                  "Engagement",
                  "Vendor",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            }
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-semibold">
                  {r.displayName || r.name}
                </td>
                <td className="px-4 py-3">{r.mobile}</td>
                <td className="px-4 py-3">{r.licenceNumber || "-"}</td>
                <td className="px-4 py-3">{r.engagementType}</td>
                <td className="px-4 py-3">{r.vendor?.name || "-"}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canViewAccounts && (
                      <Link
                        className="font-semibold text-brand-700"
                        to={`/drivers/${r.id}/ledger`}
                      >
                        Accounts
                      </Link>
                    )}
                    <button
                      onClick={() =>
                        setForm({
                          ...empty,
                          ...r,
                          vendorId: r.vendorId || "",
                          licenceExpiry: r.licenceExpiry
                            ? String(r.licenceExpiry).slice(0, 10)
                            : "",
                        })
                      }
                    >
                      <Edit size={17} />
                    </button>
                    <button onClick={() => remove(r)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          pagination={pagination}
          onPageChange={(page) =>
            setPagination((current) => ({ ...current, page }))
          }
          onLimitChange={(limit) =>
            setPagination((current) => ({ ...current, page: 1, limit }))
          }
        />
      </div>
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={save}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-5 flex justify-between">
              <h2 className="text-xl font-bold">
                {form.id ? "Edit" : "Add"} Driver
              </h2>
              <button type="button" onClick={() => setForm(null)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                Engagement
                <select
                  className={field}
                  value={form.engagementType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      engagementType: e.target.value,
                      vendorId: "",
                    })
                  }
                >
                  <option value="OWN">Own</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </label>
              {form.engagementType === "VENDOR" && (
                <label>
                  Vendor
                  <select
                    required
                    className={field}
                    value={form.vendorId}
                    onChange={(e) =>
                      setForm({ ...form, vendorId: e.target.value })
                    }
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Salutation
                <select
                  className={field}
                  value={form.salutation || ""}
                  onChange={(e) =>
                    setForm({ ...form, salutation: e.target.value })
                  }
                >
                  <option value="">None</option>
                  <option value="MR">Mr.</option>
                  <option value="MS">Ms.</option>
                </select>
              </label>
              {[
                ["name", "Name", true],
                ["mobile", "Mobile", true],
                ["alternateMobile", "Alternate Mobile"],
                ["licenceNumber", "Licence Number"],
                ["licenceType", "Licence Type"],
              ].map(([k, l, req]) => (
                <label key={k}>
                  {l}
                  <input
                    required={req}
                    className={field}
                    value={form[k] || ""}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Licence Expiry
                <input
                  type="date"
                  className={field}
                  value={form.licenceExpiry || ""}
                  onChange={(e) =>
                    setForm({ ...form, licenceExpiry: e.target.value })
                  }
                />
              </label>
              <label>
                Address
                <input
                  className={field}
                  value={form.address || ""}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>
              <label>
                Status
                <select
                  className={field}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border px-4 py-2"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">
                Save Driver
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
