import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowLeft,
  Car,
  IdCard,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Pagination from "../../components/Pagination";
import {
  createVendor,
  createVendorDriver,
  createVendorVehicle,
  deleteVendor,
  deleteVendorDriver,
  deleteVendorVehicle,
  getVendorErrorMessage,
  getVendors,
  updateVendor,
  updateVendorDriver,
  updateVendorVehicle,
} from "../../services/vendors";
import ActionNotice from "../../components/ActionNotice";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function getEmptyRecord(type) {
  if (type === "vendors") {
    return {
      name: "",
      recordType: "external_vendor",
      category: "Fleet",
      rating: "4.5",
      phone: "",
      city: "",
      status: "Active",
    };
  }

  if (type === "vehicles") {
    return {
      vendorId: "",
      ownershipType: "vendor",
      plate: "",
      type: "Sedan",
      status: "Ready",
      make: "",
      seatingCapacity: 4,
    };
  }

  return {
    vendorId: "",
    ownershipType: "vendor",
    salutation: "",
    name: "",
    license: "",
    status: "Available",
    phone: "",
    city: "",
  };
}

function getVendorOwnership(vendor) {
  return vendor?.recordType === "own_company" ? "own" : "vendor";
}

function getOwnershipLabel(value) {
  if (value === "own" || value === "own_company") return "Own";
  return "Vendor";
}

function StatusPill({ status }) {
  const tone =
    status === "Active" || status === "Ready" || status === "Available"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Inactive" || status === "Offline"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${tone}`}>
      {status}
    </span>
  );
}

function OwnershipPill({ value }) {
  const isOwn = value === "own" || value === "own_company";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        isOwn ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
      }`}
    >
      {isOwn ? "Own" : "Vendor"}
    </span>
  );
}

function EntityModal({ mode, type, record, vendors, onClose, onSave }) {
  const isEdit = mode === "edit";
  const title = `${isEdit ? "Edit" : "Add"} ${type === "vendors" ? "Vendor" : type === "vehicles" ? "Vehicle" : "Driver"}`;
  const [values, setValues] = useState(() => {
    const parentVendor = vendors.find(
      (vendor) => vendor.id === record?.vendorId,
    );
    const inferredOwnership =
      type === "vendors"
        ? undefined
        : record?.ownershipType || getVendorOwnership(parentVendor);
    return {
      ...getEmptyRecord(type),
      ...(record || {}),
      ...(inferredOwnership ? { ownershipType: inferredOwnership } : {}),
    };
  });

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleParentVendorChange(vendorId) {
    const parentVendor = vendors.find((vendor) => vendor.id === vendorId);
    setValues((current) => ({
      ...current,
      vendorId,
      ownershipType: getVendorOwnership(parentVendor),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const prefix =
      type === "vendors" ? "VEN" : type === "vehicles" ? "VEH" : "DRV";
    const parentVendor = vendors.find(
      (vendor) => vendor.id === values.vendorId,
    );
    const inheritedOwnership =
      type === "vendors" ? undefined : getVendorOwnership(parentVendor);
    onSave({
      ...values,
      ...(type === "vendors" && !isEdit
        ? { recordType: "external_vendor" }
        : {}),
      ...(inheritedOwnership ? { ownershipType: inheritedOwnership } : {}),
      id: values.id || `${prefix}-${Date.now()}`,
      seatingCapacity:
        type === "vehicles"
          ? Number(values.seatingCapacity || 0)
          : values.seatingCapacity,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500">
              {type === "vendors"
                ? "Vendor is the parent record."
                : "This child record must be linked to a vendor."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            {type !== "vendors" && (
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Parent Vendor / Company
                </span>
                <select
                  className={inputClass}
                  value={values.vendorId || ""}
                  onChange={(event) =>
                    handleParentVendorChange(event.target.value)
                  }
                  required
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} • {vendor.city} •{" "}
                      {getOwnershipLabel(vendor.recordType)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {type === "vendors" && (
              <>
                {isEdit && (
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Ownership
                    </span>
                    <div className="mt-2">
                      <OwnershipPill
                        value={values.recordType || "external_vendor"}
                      />
                    </div>
                  </div>
                )}
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Name
                  </span>
                  <input
                    className={inputClass}
                    value={values.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Phone
                  </span>
                  <input
                    className={inputClass}
                    value={values.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    City
                  </span>
                  <input
                    className={inputClass}
                    value={values.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Rating
                  </span>
                  <input
                    className={inputClass}
                    value={values.rating}
                    onChange={(event) =>
                      updateField("rating", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    className={inputClass}
                    value={values.status}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </>
            )}

            {type === "vehicles" && (
              <>
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Ownership
                  </span>
                  <div className="mt-2">
                    <OwnershipPill
                      value={
                        values.ownershipType ||
                        getVendorOwnership(
                          vendors.find(
                            (vendor) => vendor.id === values.vendorId,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Registration No.
                  </span>
                  <input
                    className={inputClass}
                    value={values.plate}
                    onChange={(event) =>
                      updateField("plate", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vehicle Type
                  </span>
                  <select
                    className={inputClass}
                    value={values.type}
                    onChange={(event) =>
                      updateField("type", event.target.value)
                    }
                  >
                    <option value="Hatchback">Hatchback</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Make / Model
                  </span>
                  <input
                    className={inputClass}
                    value={values.make}
                    onChange={(event) =>
                      updateField("make", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Seating Capacity
                  </span>
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    value={values.seatingCapacity}
                    onChange={(event) =>
                      updateField("seatingCapacity", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    className={inputClass}
                    value={values.status}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                  >
                    <option value="Ready">Ready</option>
                    <option value="On Trip">On Trip</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </label>
              </>
            )}

            {type === "drivers" && (
              <>
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Ownership
                  </span>
                  <div className="mt-2">
                    <OwnershipPill
                      value={
                        values.ownershipType ||
                        getVendorOwnership(
                          vendors.find(
                            (vendor) => vendor.id === values.vendorId,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Salutation
                  </span>
                  <select
                    className={inputClass}
                    value={values.salutation || ""}
                    onChange={(event) =>
                      updateField("salutation", event.target.value)
                    }
                  >
                    <option value="">No salutation</option>
                    <option value="MR">Mr.</option>
                    <option value="MS">Ms.</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Driver Name
                  </span>
                  <input
                    className={inputClass}
                    value={values.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Phone
                  </span>
                  <input
                    className={inputClass}
                    value={values.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    License No.
                  </span>
                  <input
                    className={inputClass}
                    value={values.license}
                    onChange={(event) =>
                      updateField("license", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    City
                  </span>
                  <input
                    className={inputClass}
                    value={values.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    className={inputClass}
                    value={values.status}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                  >
                    <option value="Available">Available</option>
                    <option value="On Route">On Route</option>
                    <option value="Offline">Offline</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VendorsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setTopbarAction } = useOutletContext() || {};
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownershipFilter, setOwnershipFilter] = useState("All");
  const [vendorRecords, setVendorRecords] = useState([]);
  const [vehicleRecords, setVehicleRecords] = useState([]);
  const [driverRecords, setDriverRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState(null);
  const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 25 });

  async function loadVendors() {
    setLoading(true);
    try {
      const result = await getVendors({
        page: pagination.page,
        limit: pagination.limit,
        ...(!selectedVendorId && search.trim()
          ? { search: search.trim() }
          : {}),
        ...(statusFilter !== "All"
          ? { status: statusFilter.toUpperCase() }
          : {}),
        ...(ownershipFilter !== "All" ? { recordType: ownershipFilter } : {}),
      });
      setVendorRecords(result.items);
      setPagination(result.pagination);
      setVehicleRecords(
        result.items.flatMap((vendor) => vendor.vehicles || []),
      );
      setDriverRecords(result.items.flatMap((vendor) => vendor.drivers || []));
    } catch (error) {
      setNotice(getVendorErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadVendors, 250);
    return () => window.clearTimeout(timer);
  }, [
    ownershipFilter,
    pagination.page,
    pagination.limit,
    search,
    statusFilter,
  ]);

  useEffect(() => {
    const createType = new URLSearchParams(location.search).get("create");

    if (createType === "vendor") {
      setSelectedVendorId("");
      setModalState({ type: "vendors", mode: "create", record: null });
      navigate("/vendors", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    setTopbarAction?.({
      label: "Add Vendor",
      icon: Plus,
      variant: "primary",
      onClick: () =>
        setModalState({ type: "vendors", mode: "create", record: null }),
    });

    return () => setTopbarAction?.(null);
  }, [setTopbarAction]);

  const vendorById = useMemo(
    () =>
      Object.fromEntries(vendorRecords.map((vendor) => [vendor.id, vendor])),
    [vendorRecords],
  );
  const query = search.trim().toLowerCase();
  const selectedVendor = vendorRecords.find(
    (vendor) => vendor.id === selectedVendorId,
  );
  const filteredVendors = vendorRecords.filter(
    (vendor) =>
      vendor.recordType !== "own_company" &&
      [
        vendor.name,
        vendor.category,
        vendor.city,
        vendor.status,
        getOwnershipLabel(vendor.recordType),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query) &&
      (statusFilter === "All" || vendor.status === statusFilter) &&
      (ownershipFilter === "All" || vendor.recordType === ownershipFilter),
  );
  const filteredVehicles = vehicleRecords.filter((vehicle) => {
    const vendor = vendorById[vehicle.vendorId];
    return [
      vehicle.plate,
      vehicle.type,
      vehicle.make,
      vehicle.status,
      vehicle.ownershipType,
      vendor?.name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const filteredDrivers = driverRecords.filter((driver) => {
    const vendor = vendorById[driver.vendorId];
    return [
      driver.name,
      driver.license,
      driver.phone,
      driver.status,
      driver.ownershipType,
      vendor?.name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const selectedVendorVehicles = filteredVehicles.filter(
    (vehicle) => vehicle.vendorId === selectedVendorId,
  );
  const selectedVendorDrivers = filteredDrivers.filter(
    (driver) => driver.vendorId === selectedVendorId,
  );

  function openModal(type, record = null) {
    setModalState({ type, mode: record?.id ? "edit" : "create", record });
  }

  async function handleSave(record) {
    const collection = modalState.type;
    try {
      if (collection === "vendors") {
        if (modalState.mode === "edit") await updateVendor(record.id, record);
        else await createVendor(record);
      } else if (collection === "vehicles") {
        if (modalState.mode === "edit")
          await updateVendorVehicle(record.vendorId, record.id, record);
        else await createVendorVehicle(record.vendorId, record);
      } else if (modalState.mode === "edit") {
        await updateVendorDriver(record.vendorId, record.id, record);
      } else {
        await createVendorDriver(record.vendorId, record);
      }
      await loadVendors();
      setNotice(
        `${collection === "vendors" ? "Vendor" : collection === "vehicles" ? "Vehicle" : "Driver"} ${modalState.mode === "edit" ? "updated" : "added"} successfully.`,
      );
      setModalState(null);
    } catch (error) {
      setNotice(getVendorErrorMessage(error));
    }
  }

  async function handleDelete(type, record) {
    if (!window.confirm(`Delete this ${type.slice(0, -1)}?`)) return;
    try {
      if (type === "vendors") await deleteVendor(record.id);
      if (type === "vehicles")
        await deleteVendorVehicle(record.vendorId, record.id);
      if (type === "drivers")
        await deleteVendorDriver(record.vendorId, record.id);
      if (type === "vendors" && selectedVendorId === record.id)
        setSelectedVendorId("");
      await loadVendors();
      setNotice(
        `${type === "vendors" ? "Vendor" : type === "vehicles" ? "Vehicle" : "Driver"} deleted.`,
      );
    } catch (error) {
      setNotice(getVendorErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <ActionNotice message={notice} onDismiss={() => setNotice("")} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {selectedVendor ? selectedVendor.name : "Vendor Records"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {selectedVendor
                ? `Vendor vehicles and drivers linked to ${selectedVendor.name}.`
                : "Select a vendor to view its linked central Vehicle and Driver records."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:w-80">
              <Search
                className="mr-2 text-slate-400"
                size={18}
                strokeWidth={2.2}
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                placeholder={
                  selectedVendor ? "Search vehicle or driver" : "Search vendor"
                }
              />
            </label>
            {!selectedVendor && (
              <>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  value={ownershipFilter}
                  onChange={(event) => {
                    setOwnershipFilter(event.target.value);
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="All">All vendors</option>
                  <option value="external_vendor">External vendor</option>
                </select>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </>
            )}
          </div>
        </div>

        {!selectedVendor && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Ownership
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    City
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Vehicles
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Drivers
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVendors.map((vendor) => {
                  const vendorVehicles = vehicleRecords.filter(
                    (vehicle) => vehicle.vendorId === vendor.id,
                  );
                  const vendorDrivers = driverRecords.filter(
                    (driver) => driver.vendorId === vendor.id,
                  );

                  return (
                    <tr
                      key={vendor.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedVendorId(vendor.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {vendor.name}
                        </p>
                        <p className="text-slate-500">{vendor.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <OwnershipPill
                          value={vendor.recordType || "external_vendor"}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendor.category}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendor.city}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendor.phone}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        ★ {vendor.rating}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendorVehicles.length}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendorDrivers.length}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={vendor.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            onClick={(event) => {
                              event.stopPropagation();
                              openModal("vendors", vendor);
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          {vendor.recordType !== "own_company" && (
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete("vendors", vendor);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        )}

        {selectedVendor && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
                <div>
                  <p className="text-slate-500">Ownership</p>
                  <div className="mt-1">
                    <OwnershipPill
                      value={selectedVendor.recordType || "external_vendor"}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-slate-500">Category</p>
                  <p className="font-semibold text-slate-900">
                    {selectedVendor.category}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">City</p>
                  <p className="font-semibold text-slate-900">
                    {selectedVendor.city}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-semibold text-slate-900">
                    {selectedVendor.phone}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Rating</p>
                  <p className="font-semibold text-slate-900">
                    ★ {selectedVendor.rating}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <div className="mt-1">
                    <StatusPill status={selectedVendor.status} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setSelectedVendorId("")}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => openModal("vendors", selectedVendor)}
                >
                  <Pencil size={16} />
                  Edit Vendor
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                onClick={() =>
                  openModal("vehicles", { vendorId: selectedVendor.id })
                }
              >
                <Car size={16} />
                Add {getOwnershipLabel(selectedVendor.recordType)} Vehicle
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                onClick={() =>
                  openModal("drivers", { vendorId: selectedVendor.id })
                }
              >
                <IdCard size={16} />
                Add {getOwnershipLabel(selectedVendor.recordType)} Driver
              </button>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-2">
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h4 className="font-semibold text-slate-900">Vehicles</h4>
                  <span className="text-sm text-slate-500">
                    {selectedVendorVehicles.length} records
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Vehicle
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Ownership
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedVendorVehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {vehicle.plate}
                            </p>
                            <p className="text-slate-500">{vehicle.make}</p>
                          </td>
                          <td className="px-4 py-3">
                            <OwnershipPill
                              value={
                                vehicle.ownershipType ||
                                getVendorOwnership(selectedVendor)
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => openModal("vehicles", vehicle)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() =>
                                  handleDelete("vehicles", vehicle)
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedVendorVehicles.length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={3}
                          >
                            No vehicles linked to this vendor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h4 className="font-semibold text-slate-900">Drivers</h4>
                  <span className="text-sm text-slate-500">
                    {selectedVendorDrivers.length} records
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Driver
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Ownership
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          City
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedVendorDrivers.map((driver) => (
                        <tr key={driver.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {driver.displayName || driver.name}
                          </td>
                          <td className="px-4 py-3">
                            <OwnershipPill
                              value={
                                driver.ownershipType ||
                                getVendorOwnership(selectedVendor)
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {driver.phone}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {driver.city}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => openModal("drivers", driver)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDelete("drivers", driver)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedVendorDrivers.length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-slate-500"
                            colSpan={5}
                          >
                            No drivers linked to this vendor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </section>

      {modalState && (
        <EntityModal
          mode={modalState.mode}
          type={modalState.type}
          record={modalState.record}
          vendors={vendorRecords}
          onClose={() => setModalState(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default VendorsPage;
