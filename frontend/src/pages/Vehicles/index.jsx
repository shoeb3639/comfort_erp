import { useEffect, useState } from "react";
import { Edit, Plus, Search, Trash2, X } from "lucide-react";
import ActionNotice from "../../components/ActionNotice";
import Pagination from "../../components/Pagination";
import { getVendors } from "../../services/vendors";
import {
  createVehicle,
  createVehicleType,
  deleteVehicle,
  listVehicles,
  listVehicleTypes,
  updateVehicle,
} from "../../services/vehicles";

const empty = {
  ownershipType: "OWN",
  vendorId: "",
  registrationNumber: "",
  vehicleTypeId: "",
  vehicleTypeName: "",
  make: "",
  model: "",
  variant: "",
  fuelType: "",
  seatingCapacity: "",
  manufacturingYear: "",
  registrationDate: "",
  insuranceExpiry: "",
  permitExpiry: "",
  fitnessExpiry: "",
  status: "ACTIVE",
};
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const dateValue = (value) => (value ? String(value).slice(0, 10) : "");

export default function VehiclesPage() {
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [types, setTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25 });

  async function load() {
    try {
      const [vehicles, vehicleTypes, vendorRows] = await Promise.all([
        listVehicles({
          page: pagination.page,
          limit: pagination.limit,
          ...(tab ? { ownershipType: tab } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        }),
        listVehicleTypes(),
        getVendors({ limit: 100 }),
      ]);
      setRecords(vehicles.items);
      setPagination(vehicles.pagination);
      setTypes(vehicleTypes);
      setVendors(
        vendorRows.items.filter((item) => item.recordType !== "own_company"),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to load vehicles.",
      });
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [tab, search, pagination.page, pagination.limit]);
  const visible = records;
  function edit(item) {
    setForm({
      ...empty,
      ...item,
      vendorId: item.vendorId || "",
      vehicleTypeId: item.vehicleTypeId,
      manufacturingYear: item.manufacturingYear || "",
      registrationDate: dateValue(item.registrationDate),
      insuranceExpiry: dateValue(item.insuranceExpiry),
      permitExpiry: dateValue(item.permitExpiry),
      fitnessExpiry: dateValue(item.fitnessExpiry),
    });
  }
  async function save(event) {
    event.preventDefault();
    try {
      let vehicleTypeId = form.vehicleTypeId;
      if (vehicleTypeId === "__new__") {
        vehicleTypeId = (await createVehicleType(form.vehicleTypeName)).id;
      }
      const payload = {
        ownershipType: form.ownershipType,
        vendorId: form.ownershipType === "VENDOR" ? form.vendorId : null,
        registrationNumber: form.registrationNumber,
        vehicleTypeId,
        make: form.make || null,
        model: form.model || null,
        variant: form.variant || null,
        fuelType: form.fuelType || null,
        seatingCapacity: form.seatingCapacity
          ? Number(form.seatingCapacity)
          : null,
        manufacturingYear: form.manufacturingYear
          ? Number(form.manufacturingYear)
          : null,
        registrationDate: form.registrationDate || null,
        insuranceExpiry: form.insuranceExpiry || null,
        permitExpiry: form.permitExpiry || null,
        fitnessExpiry: form.fitnessExpiry || null,
        status: form.status,
      };
      if (form.id) await updateVehicle(form.id, payload);
      else await createVehicle(payload);
      setForm(null);
      setNotice({
        type: "success",
        message: `Vehicle ${form.id ? "updated" : "created"} successfully.`,
      });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to save vehicle.",
      });
    }
  }
  async function remove(item) {
    if (!window.confirm(`Archive ${item.registrationNumber}?`)) return;
    try {
      await deleteVehicle(item.id);
      setNotice({ type: "success", message: "Vehicle archived successfully." });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to archive vehicle.",
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
            ["OWN", "Own Fleet"],
            ["VENDOR", "Vendor Vehicles"],
          ].map(([value, label]) => (
            <button
              key={label}
              onClick={() => {
                setTab(value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setForm({ ...empty })}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={17} /> Add Vehicle
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input
          className={`${field} pl-10`}
          placeholder="Search registration, make or model"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((current) => ({ ...current, page: 1 }));
          }}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "Registration",
                "Type",
                "Make / Model",
                "Seats",
                "Ownership",
                "Vendor",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">
                  {item.registrationNumber}
                </td>
                <td className="px-4 py-3">{item.vehicleType?.name}</td>
                <td className="px-4 py-3">
                  {[item.make, item.model].filter(Boolean).join(" ") || "-"}
                </td>
                <td className="px-4 py-3">{item.seatingCapacity || "-"}</td>
                <td className="px-4 py-3">{item.ownershipType}</td>
                <td className="px-4 py-3">{item.vendor?.name || "-"}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => edit(item)} title="Edit">
                      <Edit size={17} />
                    </button>
                    <button onClick={() => remove(item)} title="Archive">
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
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {form.id ? "Edit" : "Add"} Vehicle
              </h2>
              <button type="button" onClick={() => setForm(null)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                Ownership
                <select
                  className={field}
                  value={form.ownershipType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ownershipType: e.target.value,
                      vendorId: "",
                    })
                  }
                >
                  <option value="OWN">Own</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </label>
              {form.ownershipType === "VENDOR" && (
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
                Registration Number
                <input
                  required
                  className={field}
                  value={form.registrationNumber}
                  onChange={(e) =>
                    setForm({ ...form, registrationNumber: e.target.value })
                  }
                />
              </label>
              <label>
                Vehicle Type
                <select
                  required
                  className={field}
                  value={form.vehicleTypeId}
                  onChange={(e) =>
                    setForm({ ...form, vehicleTypeId: e.target.value })
                  }
                >
                  <option value="">Select type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="__new__">+ Add new type</option>
                </select>
              </label>
              {form.vehicleTypeId === "__new__" && (
                <label>
                  New Vehicle Type
                  <input
                    required
                    className={field}
                    value={form.vehicleTypeName}
                    onChange={(e) =>
                      setForm({ ...form, vehicleTypeName: e.target.value })
                    }
                  />
                </label>
              )}
              {[
                ["make", "Make"],
                ["model", "Model"],
                ["variant", "Variant"],
                ["fuelType", "Fuel Type"],
                ["manufacturingYear", "Manufacturing Year"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    className={field}
                    type={key === "manufacturingYear" ? "number" : "text"}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Seating Capacity
                <input
                  className={field}
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.seatingCapacity ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, seatingCapacity: e.target.value })
                  }
                />
              </label>
              {[
                ["registrationDate", "Registration Date"],
                ["insuranceExpiry", "Insurance Expiry"],
                ["permitExpiry", "Permit Expiry"],
                ["fitnessExpiry", "Fitness Expiry"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="date"
                    className={field}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
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
                onClick={() => setForm(null)}
                className="rounded-lg border px-4 py-2"
              >
                Cancel
              </button>
              <button className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">
                Save Vehicle
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
