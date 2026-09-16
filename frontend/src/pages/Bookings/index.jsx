import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ArrowUp,
  ArrowDown,
  Car,
  ChevronDown,
  CircleCheck,
  Copy,
  Edit,
  Eye,
  FileCheck,
  Mail,
  MessageCircle,
  SlidersHorizontal,
  MessageSquare,
  MoreVertical,
  Play,
  Search,
  Trash2,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import ActionNotice from "../../components/ActionNotice";
import { listDrivers } from "../../services/drivers";
import { listVehicles } from "../../services/vehicles";
import { getVendors } from "../../services/vendors";
import { getCustomers } from "../../services/customers";
import {
  assignBooking,
  cancelBooking,
  completeBookingDuty,
  confirmBooking,
  deleteBooking,
  getBookingErrorMessage,
  listBookings,
  getBookingFilterVehicles,
  startBookingDuty,
} from "../../services/bookings";

const pageSizeOptions = [10, 20, 40, 50];

const listViewOptions = [
  { value: "active", label: "Current / Ongoing" },
  { value: "closed", label: "Closed Bookings" },
];

const statusStyles = {
  Draft: "bg-slate-100 text-slate-700 ring-slate-500/20",
  Confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Assigned: "bg-sky-50 text-sky-700 ring-sky-600/20",
  Pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  "In Transit": "bg-brand-50 text-brand-700 ring-brand-600/20",
  Completed: "bg-slate-100 text-slate-700 ring-slate-500/20",
  Cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  Closed: "bg-slate-900 text-white ring-slate-900",
};

function toNumber(value) {
  return Number(String(value || 0).replace(/[^0-9.-]/g, "")) || 0;
}

function hasBillAmount(booking) {
  const invoice = booking.invoice;
  return Boolean(
    invoice ||
    toNumber(booking.closeDetails?.totalBillAmount) > 0 ||
    toNumber(booking.fixedAmount) > 0 ||
    toNumber(booking.amount) > 0,
  );
}

function isBookingClosed(booking) {
  return booking.status === "Closed" || Boolean(booking.closeDetails);
}

function StatusBadge({ status }) {
  return (
    <span
      className={`status-badge inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-2 ring-inset ${
        statusStyles[status] || "bg-slate-100 text-slate-700 ring-slate-500/20"
      }`}
    >
      {status}
    </span>
  );
}

function getBookingCategory(booking) {
  if (booking.customer_type === "Corporate") return "Corporate";
  if (["Individuals", "Retail"].includes(booking.customer_type))
    return "Individual";
  if (booking.customer_type === "Travel Agent") return "Travel Agent";
  return "—";
}

function CategoryBadge({ category }) {
  const tone =
    category === "Corporate"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
      : category === "Individual"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
        : category === "Package"
          ? "bg-amber-50 text-amber-700 ring-amber-600/20"
          : "bg-slate-100 text-slate-700 ring-slate-500/20";

  return (
    <span
      className={`status-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-2 ring-inset ${tone}`}
    >
      {category}
    </span>
  );
}

function formatDate(value, options = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return options.year ? `${day}-${month}-${year}` : `${day}-${month}`;
}

function RouteText({ locations }) {
  return <span>{locations.filter(Boolean).join(" → ") || "—"}</span>;
}

function cityNameOnly(location) {
  return String(location || "")
    .split(",")[0]
    .trim();
}

function AssignmentModal({
  booking,
  drivers,
  vehicles,
  vendors,
  onClose,
  onSave,
}) {
  const initialVehicle = vehicles.find(
    (vehicle) => vehicle.plate === booking.vehicleRegistrationNo,
  );
  const initialDriver = drivers.find(
    (driver) => driver.name === booking.driver,
  );
  const initialVendor = vendors.find(
    (vendor) =>
      vendor.name === booking.vendor || vendor.id === booking.vendorId,
  );
  const [formValues, setFormValues] = useState({
    assignmentType:
      booking.assignmentType || booking.assignment_type || "own_vehicle",
    vendorId: initialVendor?.id || booking.vendorId || "",
    vendor:
      booking.vendor && booking.vendor !== "Unassigned" ? booking.vendor : "",
    vehicleId: initialVehicle?.id || "",
    vehicleType:
      booking.vehicleType && booking.vehicleType !== "Unassigned"
        ? booking.vehicleType
        : "",
    vehicleRegistrationNo: booking.vehicleRegistrationNo || "",
    driverId: initialDriver?.id || "",
    driver:
      booking.driver && booking.driver !== "Unassigned" ? booking.driver : "",
    driverNumber:
      booking.driverNumber ||
      initialDriver?.mobile ||
      initialDriver?.phone ||
      "",
    vendorRateType: booking.vendorRateType || "Fixed Amount",
    vendorRate: booking.vendorRate || "",
  });
  const isVendorVehicle = formValues.assignmentType === "vendor_vehicle";
  const allowedVendors = isVendorVehicle ? vendors : [];
  const visibleVehicles = vehicles.filter((vehicle) => {
    const matchesVendor = formValues.vendorId
      ? vehicle.vendorId === formValues.vendorId
      : true;
    return (
      matchesVendor &&
      (isVendorVehicle
        ? vehicle.ownershipType === "VENDOR"
        : vehicle.ownershipType === "OWN")
    );
  });
  const visibleDrivers = drivers.filter((driver) => {
    const matchesVendor = formValues.vendorId
      ? driver.vendorId === formValues.vendorId
      : true;
    return (
      matchesVendor &&
      (isVendorVehicle
        ? driver.engagementType === "VENDOR"
        : driver.engagementType === "OWN")
    );
  });

  function updateField(name, value) {
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }));
  }

  function handleAssignmentTypeChange(assignmentType) {
    setFormValues((currentValues) => ({
      ...currentValues,
      assignmentType,
      vendorId: "",
      vendor: "",
      vehicleId: "",
      vehicleType: "",
      vehicleRegistrationNo: "",
      driverId: "",
      driver: "",
      driverNumber: "",
      vendorRateType:
        assignmentType === "vendor_vehicle"
          ? currentValues.vendorRateType
          : "Fixed Amount",
      vendorRate:
        assignmentType === "vendor_vehicle" ? currentValues.vendorRate : "",
    }));
  }

  function handleVendorChange(vendorId) {
    const vendor = vendors.find((item) => item.id === vendorId);
    setFormValues((currentValues) => ({
      ...currentValues,
      vendorId,
      vendor: vendor?.name || "",
      vehicleId: "",
      vehicleType: "",
      vehicleRegistrationNo: "",
      driverId: "",
      driver: "",
      driverNumber: "",
    }));
  }

  function handleVehicleChange(vehicleId) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    setFormValues((currentValues) => ({
      ...currentValues,
      vehicleId,
      vehicleType: vehicle?.make || vehicle?.type || "",
      vehicleRegistrationNo: vehicle?.plate || "",
    }));
  }

  function handleDriverChange(driverId) {
    const driver = drivers.find((item) => item.id === driverId);
    setFormValues((currentValues) => ({
      ...currentValues,
      driverId,
      driver: driver?.name || "",
      driverNumber: driver?.mobile || driver?.phone || "",
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      (isVendorVehicle && !formValues.vendor) ||
      !formValues.vehicleType ||
      !formValues.vehicleRegistrationNo ||
      !formValues.driver ||
      !formValues.driverNumber
    ) {
      return;
    }

    onSave({
      assignmentType: formValues.assignmentType,
      assignment_type: formValues.assignmentType,
      vendorId: formValues.vendorId,
      vendor: formValues.vendor,
      vehicleType: formValues.vehicleType,
      vehicleRegistrationNo: formValues.vehicleRegistrationNo,
      vehicleId: formValues.vehicleId,
      driver: formValues.driver,
      driverNumber: formValues.driverNumber,
      driverId: formValues.driverId,
      vendorRateType: isVendorVehicle ? formValues.vendorRateType : "",
      vendorRate: isVendorVehicle ? formValues.vendorRate : "",
      assignment_status: "Assigned",
      status: booking.status === "Pending" ? "Confirmed" : booking.status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/40 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">
              Assign Vehicle & Driver
            </h3>
            <p className="truncate text-sm text-slate-500">
              {booking.id} • {booking.customer}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close assignment modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-4 [&>label]:min-w-0 md:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Assignment Source
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.assignmentType}
                onChange={(event) =>
                  handleAssignmentTypeChange(event.target.value)
                }
                required
              >
                <option value="own_vehicle">Own Vehicle</option>
                <option value="vendor_vehicle">Vendor Vehicle</option>
              </select>
            </label>

            {isVendorVehicle && (
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Vendor
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  value={formValues.vendorId}
                  onChange={(event) => handleVendorChange(event.target.value)}
                  required
                >
                  <option value="">Select vendor</option>
                  {allowedVendors
                    .filter((vendor) => vendor.status === "Active")
                    .map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} • {vendor.city} •{" "}
                        {isVendorVehicle ? "Vendor" : "Own"}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label>
              <span className="text-sm font-medium text-slate-700">
                Vehicle
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleId}
                onChange={(event) => handleVehicleChange(event.target.value)}
                required
              >
                <option value="">Select vehicle</option>
                {visibleVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make || vehicle.type} • {vehicle.plate} •{" "}
                    {vehicle.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Vehicle Type
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleType}
                onChange={(event) =>
                  updateField("vehicleType", event.target.value)
                }
                required
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Vehicle No.
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleRegistrationNo}
                onChange={(event) =>
                  updateField("vehicleRegistrationNo", event.target.value)
                }
                required
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Driver</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.driverId}
                onChange={(event) => handleDriverChange(event.target.value)}
                required
              >
                <option value="">Select driver</option>
                {visibleDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} • {driver.mobile || driver.phone} •{" "}
                    {driver.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Driver Number
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.driverNumber}
                onChange={(event) =>
                  updateField("driverNumber", event.target.value)
                }
                required
              />
            </label>

            {isVendorVehicle && (
              <>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Rate Type
                  </span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={formValues.vendorRateType}
                    onChange={(event) =>
                      updateField("vendorRateType", event.target.value)
                    }
                    required
                  >
                    <option>Fixed Amount</option>
                    <option>Per KM</option>
                    <option>Per Day</option>
                    <option>Package</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Rate
                  </span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    type="number"
                    step="0.01"
                    value={formValues.vendorRate}
                    onChange={(event) =>
                      updateField("vendorRate", event.target.value)
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 sm:w-auto">
              Save Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LifecycleModal({ booking, mode, onClose, onSave }) {
  const [odometer, setOdometer] = useState("");
  const [remarks, setRemarks] = useState("");
  const [completion, setCompletion] = useState({
    tollTax: "",
    parking: "",
    driverAllowance: "",
    otherRecoverableCharges: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isStart = mode === "start";
  const isComplete = mode === "complete";
  const isCancel = mode === "cancel";
  const isOwn =
    (booking.assignmentType || booking.assignment_type) !== "vendor_vehicle";
  const title = isStart
    ? "Start Duty"
    : isComplete
      ? "Complete Duty"
      : "Cancel Booking";
  const tripStart = booking.startDate || booking.pickupDate;
  const tripEnd = booking.endDate || tripStart;
  const routeStops = (booking.routeStops || "")
    .split(">")
    .map((stop) => stop.trim())
    .filter(Boolean);
  const routeLocations = [
    booking.travellingFrom || booking.pickupReportingAddress,
    ...(routeStops.length
      ? routeStops
      : [booking.travellingTo || "Destination not fixed"]),
  ];

  function updateCompletion(name, value) {
    setCompletion((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(
        isCancel
          ? { reason: remarks }
          : isStart
            ? { openingOdometer: odometer, remarks }
            : { closingOdometer: odometer, remarks, ...completion },
      );
    } catch (requestError) {
      setError(getBookingErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3 sm:items-center sm:p-5">
      <form
        onSubmit={submit}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{booking.id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {isComplete && (
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5">
            <dt className="text-slate-500">Trip</dt>
            <dd className="font-medium text-slate-800">
              {formatDate(tripStart, { year: true })}
              {tripEnd &&
                tripStart?.slice(0, 10) !== tripEnd.slice(0, 10) &&
                ` – ${formatDate(tripEnd, { year: true })}`}
              {(booking.pickupTime || booking.reportingTime) &&
                ` · ${booking.pickupTime || booking.reportingTime}`}
            </dd>
            <dt className="text-slate-500">Assignment</dt>
            <dd className="break-words font-medium text-slate-800">
              {isOwn ? "Own" : "Vendor"}
              {!isOwn && booking.vendor && ` · ${booking.vendor}`}
              {" · "}
              {booking.vehicleRegistrationNo || "Vehicle pending"}
              {" · "}
              {booking.driver || "Driver pending"}
            </dd>
            <dt className="text-slate-500">Route</dt>
            <dd className="break-words font-medium text-slate-800">
              {routeLocations.filter(Boolean).join(" → ") || "—"}
            </dd>
          </dl>
        )}

        {!isCancel && (
          <label className="mt-5 block text-sm font-medium text-slate-700">
            {isStart ? "Opening Odometer" : "Closing Odometer"}
            {!isOwn && " (Optional)"}
            <input
              type="number"
              min="0"
              step="0.01"
              required={isOwn}
              value={odometer}
              onChange={(event) => setOdometer(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {isComplete && booking.openingOdometer !== null && (
              <span className="mt-1 block text-xs text-slate-500">
                Opening odometer: {booking.openingOdometer}
              </span>
            )}
          </label>
        )}

        {isComplete && (
          <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">
            <section>
              <h4 className="font-semibold text-slate-900">
                Recoverable Charges
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["tollTax", "Toll Tax"],
                  ["parking", "Parking"],
                  ["driverAllowance", "Driver Allowance"],
                  ["otherRecoverableCharges", "Other Charges"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="text-sm font-medium text-slate-700"
                  >
                    {label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={completion[name]}
                      onChange={(event) =>
                        updateCompletion(name, event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          {isCancel ? "Cancellation Reason" : "Remarks"}
          <textarea
            required={isCancel}
            minLength={isCancel ? 3 : undefined}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder={
              isCancel
                ? "Enter the reason for cancellation"
                : "Optional duty remarks"
            }
          />
        </label>

        <div className="sticky bottom-0 -mx-4 mt-6 flex justify-end gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
          {error && (
            <p className="mr-auto self-center text-sm font-medium text-rose-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 font-semibold"
          >
            Back
          </button>
          <button
            disabled={saving}
            className={`rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-60 ${
              isCancel ? "bg-rose-600" : "bg-brand-600"
            }`}
          >
            {saving ? "Saving…" : title}
          </button>
        </div>
      </form>
    </div>
  );
}

function BookingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [travellers, setTravellers] = useState([]);
  const filterDialogRef = useRef(null);
  const [search, setSearch] = useState("");
  const [listView, setListView] = useState("active");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortDirection, setSortDirection] = useState("desc");
  const [filters, setFilters] = useState({
    customerType: "",
    assignmentSource: "",
    vendorId: "",
    vehicleId: "",
    startDate: "",
    endDate: "",
  });
  function updateListFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "assignmentSource" ? { vendorId: "", vehicleId: "" } : {}),
      ...(key === "vendorId" ? { vehicleId: "" } : {}),
    }));
    setPage(1);
  }
  const [filterVehicles, setFilterVehicles] = useState([]);
  const [vehicleFilterError, setVehicleFilterError] = useState("");
  useEffect(() => {
    getBookingFilterVehicles()
      .then(setFilterVehicles)
      .catch((error) => setVehicleFilterError(getBookingErrorMessage(error)));
  }, []);
  const linkedVendors = [
    ...new Map(
      filterVehicles
        .filter(
          (vehicle) => vehicle.ownershipType === "VENDOR" && vehicle.vendor,
        )
        .map((vehicle) => [vehicle.vendor.id, vehicle.vendor]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const linkedVehicles = filterVehicles.filter(
    (vehicle) =>
      (!filters.assignmentSource ||
        vehicle.ownershipType === filters.assignmentSource) &&
      (!filters.vendorId || vehicle.vendorId === filters.vendorId),
  );
  const invalidDateRange =
    filters.startDate && filters.endDate && filters.startDate > filters.endDate;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState(null);
  const [openActionId, setOpenActionId] = useState("");
  const [sendDetailsBookingId, setSendDetailsBookingId] = useState("");
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const actionMenuRef = useRef(null);
  useEffect(() => {
    if (!openActionId) return;
    function closeMenu() {
      setOpenActionId("");
      setSendDetailsBookingId("");
      setActionMenuPosition(null);
    }
    function handleOutsidePointer(event) {
      if (!actionMenuRef.current?.contains(event.target)) closeMenu();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        actionMenuRef.current?.querySelector("button")?.focus();
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionId]);
  const [assignmentBooking, setAssignmentBooking] = useState(null);
  const [lifecycleAction, setLifecycleAction] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || "");

  useEffect(() => {
    Promise.all([
      getCustomers({ limit: 100 }),
      listDrivers({ status: "ACTIVE", limit: 100 }),
      listVehicles({ status: "ACTIVE", limit: 100 }),
      getVendors({ limit: 100 }),
    ])
      .then(([customerResult, driverResult, vehicleResult, vendorResult]) => {
        setCustomers(customerResult.items);
        setTravellers(
          customerResult.items.flatMap((customer) => customer.travellers || []),
        );
        setDrivers(driverResult.items);
        setVehicles(
          vehicleResult.items.map((vehicle) => ({
            ...vehicle,
            plate: vehicle.registrationNumber,
            type: vehicle.vehicleType?.name,
          })),
        );
        setVendors(
          vendorResult.items.filter(
            (vendor) => vendor.recordType !== "own_company",
          ),
        );
      })
      .catch((error) => setNotice(getBookingErrorMessage(error)));
  }, []);

  useEffect(() => {
    let active = true;
    if (invalidDateRange) return;
    const timer = window.setTimeout(() => {
      listBookings({
        page,
        limit: pageSize,
        sortDirection,
        ...Object.fromEntries(
          Object.entries(filters)
            .map(([key, value]) => [key, value.trim()])
            .filter(([, value]) => value),
        ),
        view: listView === "closed" ? "CLOSED" : "ACTIVE",
        ...(statusFilter !== "All"
          ? {
              status:
                { "In Transit": "RUNNING" }[statusFilter] ||
                statusFilter.toUpperCase(),
            }
          : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
        .then((result) => {
          if (!active) return;
          setBookings(result.items);
          setPagination(result.pagination);
        })
        .catch((error) => setNotice(getBookingErrorMessage(error)));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    listView,
    page,
    pageSize,
    search,
    statusFilter,
    filters,
    invalidDateRange,
    sortDirection,
  ]);

  const statusOptions =
    listView === "closed"
      ? ["All", "Closed"]
      : ["All", "Draft", "Confirmed", "Assigned", "In Transit", "Completed"];
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const travellerById = useMemo(
    () => new Map(travellers.map((traveller) => [traveller.id, traveller])),
    [travellers],
  );

  const totalPages = pagination?.pages || 1;
  const currentPage = pagination?.page || page;
  const paginatedBookings = bookings;

  async function handleDeleteBooking(id) {
    try {
      await deleteBooking(id);
      setBookings((current) => current.filter((item) => item.id !== id));
      setOpenActionId("");
      setNotice(`Booking ${id} deleted.`);
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
    }
  }

  async function handleAssignBooking(id, assignment) {
    try {
      const updated = await assignBooking(id, assignment);
      setBookings((current) =>
        current.map((booking) => (booking.id === id ? updated : booking)),
      );
      setOpenActionId("");
      setAssignmentBooking(null);
      setNotice(`Booking ${id} assigned successfully.`);
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
    }
  }

  function replaceBooking(updated, message) {
    setBookings((current) =>
      current.map((booking) => (booking.id === updated.id ? updated : booking)),
    );
    setOpenActionId("");
    setLifecycleAction(null);
    setNotice(message);
  }

  async function handleConfirmBooking(booking) {
    try {
      const updated = await confirmBooking(booking.id);
      replaceBooking(updated, `Booking ${booking.id} confirmed.`);
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
    }
  }

  async function handleLifecycleSave(values) {
    if (!lifecycleAction) return;
    const { booking, mode } = lifecycleAction;
    try {
      const updated =
        mode === "start"
          ? await startBookingDuty(booking.id, values)
          : mode === "complete"
            ? await completeBookingDuty(booking.id, values)
            : await cancelBooking(booking.id, values.reason);
      replaceBooking(
        updated,
        mode === "start"
          ? `Duty started for ${booking.id}.`
          : mode === "complete"
            ? `Duty completed for ${booking.id}.`
            : `Booking ${booking.id} cancelled.`,
      );
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
      throw error;
    }
  }

  function handleSendMessage(booking) {
    console.log("Send booking message", booking);
    setOpenActionId("");
    setNotice(`Message prepared for ${booking.id}.`);
  }

  async function handleCopyBookingMessage(booking) {
    const startDate = formatDate(booking.startDate || booking.pickupDate, {
      year: true,
    });
    const endDate = formatDate(
      booking.endDate || booking.startDate || booking.pickupDate,
      {
        year: true,
      },
    );
    const route = [
      booking.travellingFrom || booking.pickupReportingAddress,
      ...(booking.routeStops || "")
        .split(">")
        .map((stop) => stop.trim())
        .filter(Boolean),
      booking.travellingTo,
    ]
      .filter(Boolean)
      .join(" → ");
    const message = [
      `Booking Details · ${booking.id}`,
      `Traveller: ${booking.travellerName || booking.customer || "-"}`,
      `Trip: ${startDate}${startDate !== endDate ? ` to ${endDate}` : ""}${booking.pickupTime ? ` · ${booking.pickupTime}` : ""}`,
      `Route: ${route || booking.serviceCity || "-"}`,
      `Vehicle: ${booking.vehicleRegistrationNo || booking.requestedVehicleType || "To be assigned"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(message);
      setNotice("Booking details copied.");
    } catch {
      setNotice(
        "Unable to copy booking details. Please allow clipboard access.",
      );
    } finally {
      setOpenActionId("");
      setSendDetailsBookingId("");
    }
  }

  function handleListViewChange(value) {
    setListView(value);
    setStatusFilter("All");
    setPage(1);
  }

  function handlePageSizeChange(value) {
    setPageSize(Number(value));
    setPage(1);
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <ActionNotice
        message={notice}
        onDismiss={() => {
          setNotice("");
          navigate(".", { replace: true, state: null });
        }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Booking List
          </h3>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(180px,320px)_190px_auto]">
            <label className="col-span-2 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:col-span-1">
              <Search
                className="mr-2 text-slate-400"
                size={18}
                strokeWidth={2.2}
              />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Search customer, route, vendor, driver"
              />
            </label>

            <select
              value={listView}
              onChange={(event) => handleListViewChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {listViewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => filterDialogRef.current?.showModal()}
              aria-label="Open booking filters"
              aria-haspopup="dialog"
              title="Filters"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <SlidersHorizontal size={18} />
              {Object.values(filters).filter((value) => value.trim()).length +
                (statusFilter !== "All" ? 1 : 0) >
                0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                  {Object.values(filters).filter((value) => value.trim())
                    .length + (statusFilter !== "All" ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        <dialog
          ref={filterDialogRef}
          aria-labelledby="booking-filters-title"
          onClick={(event) => {
            if (event.target === event.currentTarget)
              filterDialogRef.current?.close();
          }}
          className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-sm border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"
        >
          <div className="flex min-h-full flex-col p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3
                id="booking-filters-title"
                className="text-base font-semibold text-slate-900"
              >
                Booking filters
              </h3>
              <button
                type="button"
                onClick={() => filterDialogRef.current?.close()}
                aria-label="Close filters"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "All" ? "All statuses" : status}
                    </option>
                  ))}
                </select>
              </label>
              {[
                [
                  "customerType",
                  "Customer category",
                  [
                    ["CORPORATE", "Corporate"],
                    ["RETAIL", "Individual"],
                    ["TRAVEL_AGENT", "Travel Agent"],
                  ],
                ],
                [
                  "assignmentSource",
                  "Vehicle ownership",
                  [
                    ["OWN", "Own vehicle"],
                    ["VENDOR", "Vendor vehicle"],
                  ],
                ],
              ].map(([key, label, options]) => (
                <label key={key} className="text-xs font-medium text-slate-500">
                  {label}
                  <select
                    value={filters[key]}
                    onChange={(event) =>
                      updateListFilter(key, event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
                  >
                    <option value="">All</option>
                    {options.map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {filters.assignmentSource === "VENDOR" && (
                <label className="text-xs font-medium text-slate-500">
                  Vendor
                  <select
                    value={filters.vendorId}
                    onChange={(event) =>
                      updateListFilter("vendorId", event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
                  >
                    <option value="">All vendors</option>
                    {linkedVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-xs font-medium text-slate-500">
                Linked vehicle
                <select
                  value={filters.vehicleId}
                  onChange={(event) =>
                    updateListFilter("vehicleId", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
                >
                  <option value="">
                    All{" "}
                    {filters.assignmentSource === "OWN"
                      ? "own"
                      : filters.assignmentSource === "VENDOR"
                        ? "vendor"
                        : "linked"}{" "}
                    vehicles
                  </option>
                  {linkedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {[vehicle.make, vehicle.model]
                        .filter(Boolean)
                        .join(" ") ||
                        vehicle.vehicleType?.name ||
                        "Vehicle"}{" "}
                      · {vehicle.registrationNumber}
                    </option>
                  ))}
                </select>
                {vehicleFilterError && (
                  <span role="alert" className="mt-1 block text-rose-600">
                    {vehicleFilterError}
                  </span>
                )}
                {!vehicleFilterError && !linkedVehicles.length && (
                  <span className="mt-1 block text-slate-400">
                    No linked vehicles available.
                  </span>
                )}
              </label>
              <fieldset>
                <legend className="text-xs font-medium text-slate-500">
                  Trip start date range
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    ["startDate", "From"],
                    ["endDate", "To"],
                  ].map(([key, label]) => (
                    <label key={key} className="min-w-0 text-xs text-slate-500">
                      {label}
                      <input
                        type="date"
                        value={filters[key]}
                        onChange={(event) =>
                          updateListFilter(key, event.target.value)
                        }
                        min={
                          key === "endDate"
                            ? filters.startDate || undefined
                            : undefined
                        }
                        max={
                          key === "startDate"
                            ? filters.endDate || undefined
                            : undefined
                        }
                        className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700"
                      />
                    </label>
                  ))}
                </div>
                {invalidDateRange && (
                  <p role="alert" className="mt-1 text-xs text-rose-600">
                    To date must be on or after From date.
                  </p>
                )}
              </fieldset>
            </div>
            {(search ||
              statusFilter !== "All" ||
              Object.values(filters).some(Boolean)) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("All");
                  setFilters({
                    customerType: "",
                    assignmentSource: "",
                    vendorId: "",
                    vehicleId: "",
                    startDate: "",
                    endDate: "",
                  });
                  setPage(1);
                }}
                className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={() => filterDialogRef.current?.close()}
              disabled={Boolean(invalidDateRange)}
              className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Show results
            </button>
          </div>
        </dialog>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[160px] px-4 py-3">Booking Id</th>
                <th className="w-[190px] px-4 py-3">Customer</th>
                <th
                  aria-sort={
                    sortDirection === "asc" ? "ascending" : "descending"
                  }
                  className="w-[165px] px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortDirection((current) =>
                        current === "desc" ? "asc" : "desc",
                      );
                      setPage(1);
                    }}
                    title={
                      sortDirection === "desc"
                        ? "Sort earliest trip first"
                        : "Sort latest trip first"
                    }
                    className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Trip Dates
                    {sortDirection === "asc" ? (
                      <ArrowUp size={14} />
                    ) : (
                      <ArrowDown size={14} />
                    )}
                  </button>
                </th>
                <th className="w-[220px] px-4 py-3">Travelling</th>
                <th className="w-[170px] px-4 py-3">Assigned to</th>
                <th className="w-[180px] px-4 py-3">Vehicle Details</th>
                <th className="w-[110px] px-4 py-3">Status</th>
                <th className="w-[70px] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedBookings.map((booking) => {
                const customer = customerById.get(booking.billing_customer_id);
                const traveller = travellerById.get(booking.traveller_id);
                const customerName =
                  traveller?.name ||
                  booking.travellerName ||
                  customer?.displayName ||
                  booking.customer ||
                  "-";
                const companyName = ["Individuals", "Retail"].includes(
                  booking.customer_type,
                )
                  ? customer?.billingName || customerName
                  : customer?.billingName ||
                    customer?.name ||
                    booking.customer ||
                    "-";
                const mobileNumber =
                  traveller?.phone ||
                  customer?.phone ||
                  booking.customerPhone ||
                  "—";
                const routeStops = booking.routeStops
                  ? booking.routeStops
                      .split(">")
                      .map((stop) => stop.trim())
                      .filter(Boolean)
                  : [];
                const routeLocations = [
                  booking.travellingFrom ||
                    booking.pickupReportingAddress ||
                    "",
                  ...(routeStops.length
                    ? routeStops
                    : [booking.travellingTo || "Destination not fixed"]),
                ];
                const routeCityLocations = routeLocations.map(cityNameOnly);
                const tripStartValue = booking.startDate || booking.pickupDate;
                const tripEndValue =
                  booking.endDate || booking.startDate || booking.pickupDate;
                const tripStart = formatDate(tripStartValue, { year: true });
                const tripEnd = formatDate(tripEndValue, { year: true });
                const isSameTripDate =
                  tripStartValue &&
                  tripEndValue &&
                  new Date(tripStartValue).toDateString() ===
                    new Date(tripEndValue).toDateString();
                const tripDateText = isSameTripDate
                  ? tripStart
                  : `${tripStart} to ${tripEnd}`;
                const pickupTime =
                  booking.pickupTime || booking.reportingTime || "";
                const isVendorVehicle =
                  (booking.assignmentType || booking.assignment_type) ===
                  "vendor_vehicle";

                return (
                  <tr
                    key={booking.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`View booking ${booking.id}`}
                    className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/bookings/${booking.id}`);
                      }
                    }}
                  >
                    <td className="w-[160px] px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-semibold text-slate-950">
                          {booking.id}
                        </span>
                        <CategoryBadge category={getBookingCategory(booking)} />
                      </div>
                    </td>
                    <td className="w-[190px] max-w-[190px] px-4 py-3 text-slate-700">
                      <span className="block truncate" title={customerName}>
                        {customerName}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {mobileNumber}
                      </span>
                      {companyName &&
                        companyName !== "-" &&
                        companyName.trim().toLowerCase() !==
                          customerName.trim().toLowerCase() && (
                          <span
                            className="mt-1 block truncate text-xs text-slate-400"
                            title={companyName}
                          >
                            {companyName}
                          </span>
                        )}
                    </td>
                    <td className="w-[165px] whitespace-nowrap px-4 py-3 text-slate-700">
                      <span>{tripDateText}</span>
                      {pickupTime && (
                        <span className="ml-1 text-slate-400">
                          · {pickupTime}
                        </span>
                      )}
                    </td>
                    <td className="w-[220px] px-4 py-3 leading-5 text-slate-700">
                      <span className="block break-words">
                        <RouteText locations={routeCityLocations} />
                      </span>
                    </td>
                    <td className="w-[170px] max-w-[170px] px-4 py-3 text-slate-700">
                      <div className="flex flex-col items-start gap-1">
                        <span className="truncate">
                          {isVendorVehicle
                            ? booking.vendor || "Unassigned"
                            : booking.tenantCompanyName || "Own company"}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isVendorVehicle ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {isVendorVehicle ? "Vendor" : "Own"}
                        </span>
                      </div>
                    </td>
                    <td className="w-[180px] max-w-[180px] px-4 py-3 text-slate-700">
                      <span className="truncate">
                        {[booking.vehicle?.make, booking.vehicle?.model]
                          .filter(Boolean)
                          .join(" ") ||
                          booking.vehicleType ||
                          booking.requestedVehicleType ||
                          "Vehicle pending"}
                      </span>
                      <span className="ml-1 text-slate-400">
                        · {booking.vehicleRegistrationNo || "Not assigned"}
                      </span>
                    </td>
                    <td className="w-[110px] whitespace-nowrap px-4 py-3">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td
                      className="w-[70px] px-4 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div
                        ref={openActionId === booking.id ? actionMenuRef : null}
                        className="relative inline-flex justify-end"
                      >
                        <button
                          type="button"
                          aria-expanded={openActionId === booking.id}
                          aria-label={`Open actions for ${booking.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          onClick={(event) => {
                            const willOpen = openActionId !== booking.id;
                            if (!willOpen) {
                              setOpenActionId("");
                              setActionMenuPosition(null);
                              return;
                            }
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            const opensUpward =
                              rect.bottom + 420 > window.innerHeight;
                            setActionMenuPosition({
                              right: Math.max(
                                8,
                                window.innerWidth - rect.right,
                              ),
                              ...(opensUpward
                                ? {
                                    bottom: Math.max(
                                      8,
                                      window.innerHeight - rect.top + 4,
                                    ),
                                  }
                                : { top: rect.bottom + 4 }),
                            });
                            setOpenActionId(booking.id);
                          }}
                        >
                          <MoreVertical size={17} />
                        </button>

                        {openActionId === booking.id && (
                          <div
                            className="fixed z-50 max-h-[calc(100vh-1rem)] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl"
                            style={actionMenuPosition || undefined}
                          >
                            <Link
                              to={`/bookings/${booking.id}`}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId("")}
                            >
                              <Eye size={16} />
                              View
                            </Link>
                            {!["Completed", "Closed", "Cancelled"].includes(
                              booking.status,
                            ) && (
                              <Link
                                to={`/bookings/${booking.id}/edit`}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => setOpenActionId("")}
                              >
                                <Edit size={16} />
                                Edit
                              </Link>
                            )}
                            {booking.vehicleId &&
                              booking.driverId &&
                              ["Assigned", "In Transit"].includes(
                                booking.status,
                              ) && (
                                <Link
                                  to={`/bookings/${booking.id}/duty-slip`}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                                  onClick={() => setOpenActionId("")}
                                >
                                  <FileCheck size={16} />
                                  Generate Duty Slip
                                </Link>
                              )}
                            {booking.status === "Draft" && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleConfirmBooking(booking)}
                              >
                                <CircleCheck size={16} />
                                Confirm Booking
                              </button>
                            )}
                            {["Confirmed", "Assigned"].includes(
                              booking.status,
                            ) && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setAssignmentBooking(booking);
                                  setOpenActionId("");
                                }}
                              >
                                <Car size={16} />
                                {booking.status === "Assigned"
                                  ? "Change Assignment"
                                  : "Assign Vehicle & Driver"}
                              </button>
                            )}
                            {booking.status === "Assigned" && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                                onClick={() => {
                                  setLifecycleAction({
                                    booking,
                                    mode: "start",
                                  });
                                  setOpenActionId("");
                                }}
                              >
                                <Play size={16} />
                                Start Duty
                              </button>
                            )}
                            {booking.status === "In Transit" && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  setLifecycleAction({
                                    booking,
                                    mode: "complete",
                                  });
                                  setOpenActionId("");
                                }}
                              >
                                <CircleCheck size={16} />
                                Complete Duty
                              </button>
                            )}
                            {booking.status === "Completed" && (
                              <Link
                                to={`/bookings/${booking.id}/close`}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => setOpenActionId("")}
                              >
                                <FileCheck size={16} />
                                Close Booking
                              </Link>
                            )}
                            {isBookingClosed(booking) &&
                              hasBillAmount(booking) && (
                                <Link
                                  to={`/bookings/${booking.id}/collections`}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => setOpenActionId("")}
                                >
                                  <WalletCards size={16} />
                                  Collection
                                </Link>
                              )}
                            {isBookingClosed(booking) && (
                              <Link
                                to={`/bookings/${booking.id}/profit`}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => setOpenActionId("")}
                              >
                                <BarChart3 size={16} />
                                Profit
                              </Link>
                            )}
                            <button
                              type="button"
                              aria-expanded={
                                sendDetailsBookingId === booking.id
                              }
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() =>
                                setSendDetailsBookingId((current) =>
                                  current === booking.id ? "" : booking.id,
                                )
                              }
                            >
                              <MessageSquare size={16} />
                              Send Details
                              <ChevronDown
                                size={15}
                                className={`ml-auto transition-transform ${
                                  sendDetailsBookingId === booking.id
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                            {sendDetailsBookingId === booking.id && (
                              <div className="ml-5 border-l border-slate-200 pl-2">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => handleSendMessage(booking)}
                                >
                                  <MessageSquare size={16} />
                                  Send Message
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() =>
                                    handleCopyBookingMessage(booking)
                                  }
                                >
                                  <Copy size={16} />
                                  Copy Message
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => {
                                    setOpenActionId("");
                                    setSendDetailsBookingId("");
                                    setNotice(
                                      "WhatsApp sharing will be available soon.",
                                    );
                                  }}
                                >
                                  <MessageCircle size={16} />
                                  Send WhatsApp
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenActionId("");
                                    setSendDetailsBookingId("");
                                    setNotice(
                                      "Email sharing will be available soon.",
                                    );
                                  }}
                                >
                                  <Mail size={16} />
                                  Send Email
                                </button>
                              </div>
                            )}
                            {[
                              "Draft",
                              "Confirmed",
                              "Assigned",
                              "In Transit",
                            ].includes(booking.status) && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                                onClick={() => {
                                  setLifecycleAction({
                                    booking,
                                    mode: "cancel",
                                  });
                                  setOpenActionId("");
                                }}
                              >
                                <XCircle size={16} />
                                Cancel Booking
                              </button>
                            )}
                            {["Draft", "Confirmed"].includes(booking.status) &&
                              !booking.vehicleId && (
                                <button
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                                  onClick={() =>
                                    handleDeleteBooking(booking.id)
                                  }
                                >
                                  <Trash2 size={16} />
                                  Delete Booking
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginatedBookings.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              No bookings found.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {paginatedBookings.length} of {pagination?.total || 0}{" "}
            bookings
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2">
              <span className="font-medium text-slate-700">
                Records per page
              </span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="px-2 font-medium text-slate-900">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {assignmentBooking && (
        <AssignmentModal
          booking={assignmentBooking}
          drivers={drivers}
          vehicles={vehicles}
          vendors={vendors}
          onClose={() => setAssignmentBooking(null)}
          onSave={(assignment) =>
            handleAssignBooking(assignmentBooking.id, assignment)
          }
        />
      )}
      {lifecycleAction && (
        <LifecycleModal
          booking={lifecycleAction.booking}
          mode={lifecycleAction.mode}
          onClose={() => setLifecycleAction(null)}
          onSave={handleLifecycleSave}
        />
      )}
    </div>
  );
}

export default BookingsPage;
