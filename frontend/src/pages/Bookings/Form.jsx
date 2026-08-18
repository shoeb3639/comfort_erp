import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import {
  createBooking,
  getBooking,
  getBookingErrorMessage,
  updateBooking,
} from "../../services/bookings";
import {
  createCustomer,
  createCustomerTraveller,
  getCustomers,
} from "../../services/customers";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const requestedVehicleTypeOptions = [
  "Dzire",
  "Aura",
  "Nexon",
  "Ertiga",
  "Kia Carens",
  "Innova Crysta",
  "Innova Hycross",
  "Traveller 15 Seater",
  "Traveller 17 Seater",
  "Traveller 20 Seater",
  "Urbania 15 Seater",
  "Urbania 17 Seater",
  "Urbania 20 Seater",
  "Coach",
  "Luxury",
];

const bookingTypeOptions = [
  { value: "package", label: "Package" },
  { value: "local", label: "Local" },
  { value: "airport_transfer", label: "Airport Transfer" },
  { value: "railway_station_transfer", label: "Railway Station Transfer" },
  { value: "outstation", label: "Outstation" },
];

const requiredDutyDocumentOptions = [
  { value: "CLOSING_METER_PHOTO", label: "Closing Meter Photo" },
  { value: "SIGNED_DUTY_SLIP", label: "Signed Duty Slip" },
  {
    value: "TOLL_PARKING_RECEIPTS",
    label: "Toll and Parking Statement / Receipts",
  },
];

const dutyPackageOptions = {
  local: [
    {
      value: "local_8_80",
      label: "8 Hrs / 80 Kms",
      includedHours: 8,
      includedKm: 80,
    },
    {
      value: "local_12_120",
      label: "12 Hrs / 120 Kms",
      includedHours: 12,
      includedKm: 120,
    },
    {
      value: "local_12_200",
      label: "12 Hrs / 200 Kms",
      includedHours: 12,
      includedKm: 200,
    },
  ],
  outstation: [
    {
      value: "outstation_min_200",
      label: "Minimum 200 Km / Day",
      dailyMinimumKm: 200,
    },
    {
      value: "outstation_min_250",
      label: "Minimum 250 Km / Day",
      dailyMinimumKm: 250,
    },
    {
      value: "outstation_min_300",
      label: "Minimum 300 Km / Day",
      dailyMinimumKm: 300,
    },
  ],
  airport_transfer: [{ value: "airport_transfer", label: "Airport Transfer" }],
  railway_station_transfer: [
    { value: "railway_station_transfer", label: "Railway Station Transfer" },
  ],
};

function FieldError({ message }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

function AddTravellerModal({ customer, customerType, onClose, onSave }) {
  const isTravelAgent = customerType === "Travel Agent";
  const label = isTravelAgent ? "Guest" : "Employee / Traveller";
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      department: "",
      employee_id: "",
      notes: "",
      status: "Active",
    },
  });

  function submitTraveller(values) {
    onSave({
      ...values,
      id: `TRV-${Date.now()}`,
      customer_id: customer.id,
      traveller_type: isTravelAgent ? "Guest" : "Employee",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Add New {label}
            </h3>
            <p className="text-sm text-slate-500">
              Save under {customer.displayName}.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close traveller modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit(submitTraveller)}>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                className={fieldClass}
                placeholder={isTravelAgent ? "Guest name" : "Employee name"}
                {...register("name", {
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Enter at least 2 characters",
                  },
                })}
              />
              <FieldError message={errors.name?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                className={fieldClass}
                placeholder="+91 98765 43210"
                {...register("phone", {
                  required: "Phone is required",
                  minLength: {
                    value: 8,
                    message: "Enter a valid phone number",
                  },
                })}
              />
              <FieldError message={errors.phone?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className={fieldClass}
                type="email"
                placeholder="traveller@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: "Enter a valid email",
                  },
                })}
              />
              <FieldError message={errors.email?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select className={fieldClass} {...register("status")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>

            {!isTravelAgent && (
              <>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Department
                  </span>
                  <input
                    className={fieldClass}
                    placeholder="Finance"
                    {...register("department")}
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Employee ID
                  </span>
                  <input
                    className={fieldClass}
                    placeholder="EMP-1024"
                    {...register("employee_id")}
                  />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className={`${fieldClass} min-h-24 resize-y`}
                placeholder="Traveller preferences or instructions"
                {...register("notes", {
                  maxLength: {
                    value: 240,
                    message: "Notes must be 240 characters or less",
                  },
                })}
              />
              <FieldError message={errors.notes?.message} />
            </label>
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
              Save {label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddCustomerModal({ onClose, onSave }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: "Individuals",
      salutation: "Mr.",
      displayName: "",
      travellerName: "",
      phone: "",
      email: "",
      city: "Prayagraj",
      gstin: "",
      address: "",
      status: "Active",
    },
  });
  const customerType = watch("type");
  const displayName = watch("displayName");
  const travellerLabel =
    customerType === "Travel Agent"
      ? "Guest / Traveller Name"
      : customerType === "Corporate"
        ? "Employee / Traveller Name"
        : "Traveller Name";

  function submitCustomer(values) {
    const timestamp = Date.now();
    const customerId = `CUST-${timestamp}`;
    const personName = values.travellerName || values.displayName;
    const formattedPersonName = `${values.salutation} ${personName}`.trim();
    const customerDisplayName =
      values.type === "Individuals" ? formattedPersonName : values.displayName;
    const newCustomer = {
      id: customerId,
      type: values.type,
      salutation: values.salutation,
      name: customerDisplayName,
      displayName: customerDisplayName,
      billingName: customerDisplayName,
      email: values.email,
      phone: values.phone,
      city: values.city,
      gstin: values.gstin,
      address: values.address,
      status: values.status,
      creditLimit: 0,
      outstanding: 0,
      contacts: [
        {
          name: formattedPersonName,
          role: values.type === "Individuals" ? "Primary" : "Billing Contact",
          phone: values.phone,
          email: values.email,
        },
      ],
      travellers: [formattedPersonName],
      rateCards: [],
      bookings: [],
      invoices: [],
      payments: [],
      documents: [],
    };
    const newTraveller = {
      id: `TRV-${timestamp}`,
      customer_id: customerId,
      traveller_type:
        values.type === "Individuals"
          ? "Individuals"
          : values.type === "Travel Agent"
            ? "Guest"
            : "Employee",
      salutation: values.salutation,
      name: formattedPersonName,
      phone: values.phone,
      email: values.email,
      department: "",
      employee_id: "",
      notes:
        values.type === "Individuals"
          ? "Individual customer travels as self."
          : "Created from booking form.",
      status: "Active",
    };

    onSave(newCustomer, newTraveller);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Add New Customer
            </h3>
            <p className="text-sm text-slate-500">
              Create a billing customer and select it for this booking.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close customer modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit(submitCustomer)}>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Customer Type
              </span>
              <select
                className={fieldClass}
                {...register("type", { required: "Customer type is required" })}
              >
                <option value="Individuals">Individuals</option>
                <option value="Corporate">Corporate</option>
                <option value="Travel Agent">Travel Agent</option>
              </select>
              <FieldError message={errors.type?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Gender / Title
              </span>
              <select
                className={fieldClass}
                {...register("salutation", { required: "Title is required" })}
              >
                <option value="Mr.">Male - Mr.</option>
                <option value="Ms.">Female - Ms.</option>
              </select>
              <FieldError message={errors.salutation?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                {customerType === "Individuals"
                  ? "Customer Name"
                  : "Company / Agency Name"}
              </span>
              <input
                className={fieldClass}
                placeholder={
                  customerType === "Individuals"
                    ? "Customer name"
                    : "Billing company name"
                }
                {...register("displayName", {
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Enter at least 2 characters",
                  },
                })}
              />
              <FieldError message={errors.displayName?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                {travellerLabel}
              </span>
              <input
                className={fieldClass}
                placeholder={
                  customerType === "Individuals"
                    ? displayName || "Same as customer"
                    : "Person travelling"
                }
                {...register("travellerName", {
                  validate: (value) => {
                    if (customerType !== "Individuals" && !value)
                      return "Traveller name is required";
                    if (value && value.length < 2)
                      return "Enter at least 2 characters";
                    return true;
                  },
                })}
              />
              <FieldError message={errors.travellerName?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                className={fieldClass}
                placeholder="+91 98765 43210"
                {...register("phone", {
                  required: "Phone is required",
                  minLength: {
                    value: 8,
                    message: "Enter a valid phone number",
                  },
                })}
              />
              <FieldError message={errors.phone?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className={fieldClass}
                type="email"
                placeholder="customer@example.com"
                {...register("email", {
                  pattern: {
                    value: /^$|^\S+@\S+\.\S+$/,
                    message: "Enter a valid email",
                  },
                })}
              />
              <FieldError message={errors.email?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">City</span>
              <input
                className={fieldClass}
                placeholder="Prayagraj"
                {...register("city")}
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                GST Number
              </span>
              <input
                className={fieldClass}
                placeholder="Optional"
                {...register("gstin")}
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select className={fieldClass} {...register("status")}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Address
              </span>
              <textarea
                className={`${fieldClass} min-h-20 resize-y`}
                placeholder="Billing address"
                {...register("address")}
              />
            </label>
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
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BookingFormPage() {
  const params = useParams();
  const bookingId = params.id || params.bookingId;
  const navigate = useNavigate();
  const isEditMode = Boolean(bookingId);
  const [existingBooking, setExistingBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [travellerOptions, setTravellerOptions] = useState([]);
  const [isTravellerModalOpen, setIsTravellerModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitSuccessful },
  } = useForm({
    defaultValues: {
      customer_type: existingBooking?.customer_type || "",
      billing_customer_id: existingBooking?.billing_customer_id || "",
      traveller_id: existingBooking?.traveller_id || "",
      booking_type:
        existingBooking?.booking_type === "km_running"
          ? "outstation"
          : existingBooking?.booking_type || "",
      duty_package: existingBooking?.duty_package || "",
      assignmentType:
        existingBooking?.assignmentType ||
        existingBooking?.assignment_type ||
        "own_vehicle",
      requestedVehicleType:
        existingBooking?.requestedVehicleType ||
        existingBooking?.vehicleRequirement ||
        "",
      trip_type: existingBooking?.trip_type || "one_way",
      billing_model:
        existingBooking?.billing_model ||
        existingBooking?.pricing_basis ||
        "fixed",
      startDate:
        existingBooking?.startDate || existingBooking?.pickupDate || "",
      endDate: existingBooking?.endDate || existingBooking?.pickupDate || "",
      pickupTime:
        existingBooking?.pickupTime || existingBooking?.reportingTime || "",
      serviceCity: existingBooking?.serviceCity || "",
      travellingFrom: existingBooking?.travellingFrom || "",
      travellingTo: existingBooking?.travellingTo || "",
      pickupReportingAddress: existingBooking?.pickupReportingAddress || "",
      routeStops: existingBooking?.routeStops || "",
      packageDetails: existingBooking?.packageDetails || "",
      fixedAmount:
        existingBooking?.fixedAmount ||
        (existingBooking?.pricing_basis === "fixed"
          ? existingBooking?.amount
          : ""),
      ratePerKm:
        existingBooking?.ratePerKm ||
        (existingBooking?.pricing_basis === "rate_per_km"
          ? existingBooking?.amount
          : ""),
      notes: existingBooking?.notes || "",
      supportingDocumentsRequired:
        (existingBooking?.requiredDutyDocuments || []).length > 0,
      requiredDutyDocuments: existingBooking?.requiredDutyDocuments || [],
    },
  });

  useEffect(() => {
    Promise.all([
      getCustomers({ limit: 100 }),
      isEditMode ? getBooking(bookingId) : null,
    ])
      .then(([customerResult, booking]) => {
        const customers = customerResult.items;
        setCustomerOptions(customers);
        setTravellerOptions(
          customers.flatMap((customer) => customer.travellers || []),
        );
        if (booking) {
          setExistingBooking(booking);
          reset({
            customer_type: booking.customer_type || "",
            billing_customer_id: booking.billing_customer_id || "",
            traveller_id: booking.traveller_id || "",
            booking_type: booking.booking_type || "",
            duty_package: booking.duty_package || "",
            assignmentType: booking.assignmentType || "own_vehicle",
            requestedVehicleType: booking.requestedVehicleType || "",
            trip_type: booking.trip_type || "one_way",
            billing_model: booking.billing_model || "fixed",
            startDate: booking.startDate || "",
            endDate: booking.endDate || "",
            pickupTime: booking.pickupTime || "",
            serviceCity: booking.serviceCity || "",
            travellingFrom: booking.travellingFrom || "",
            travellingTo: booking.travellingTo || "",
            pickupReportingAddress: booking.pickupReportingAddress || "",
            routeStops: booking.routeStops || "",
            packageDetails: booking.packageDetails || "",
            fixedAmount: booking.fixedAmount || "",
            ratePerKm: booking.ratePerKm || "",
            notes: booking.notes || "",
            supportingDocumentsRequired:
              (booking.requiredDutyDocuments || []).length > 0,
            requiredDutyDocuments: booking.requiredDutyDocuments || [],
          });
        }
      })
      .catch((error) => setLoadError(getBookingErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [bookingId, isEditMode, reset]);

  const selectedCustomerType = watch("customer_type");
  const selectedCustomerId = watch("billing_customer_id");
  const selectedTravellerId = watch("traveller_id");
  const selectedBookingType = watch("booking_type");
  const selectedTripType = watch("trip_type");
  const selectedBillingModel = watch("billing_model");
  const selectedStartDate = watch("startDate");
  const supportingDocumentsRequired = watch("supportingDocumentsRequired");
  const selectedRequiredDutyDocuments = watch("requiredDutyDocuments") || [];
  const selectedCustomer = customerOptions.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const filteredCustomers = customerOptions.filter(
    (customer) => customer.type === selectedCustomerType,
  );
  const filteredTravellers = travellerOptions.filter(
    (traveller) =>
      traveller.customer_id === selectedCustomerId &&
      traveller.status === "Active",
  );
  const shouldShowTravellerSelect =
    selectedCustomerType === "Corporate" ||
    selectedCustomerType === "Travel Agent";
  const travellerLabel =
    selectedCustomerType === "Travel Agent"
      ? "Traveller / Guest"
      : "Traveller / Employee";
  const addTravellerLabel =
    selectedCustomerType === "Travel Agent"
      ? "+ Add New Guest / Traveller"
      : "+ Add New Employee / Traveller";
  const isTransferBooking =
    selectedBookingType === "airport_transfer" ||
    selectedBookingType === "railway_station_transfer";
  const selectedDutyPackageOptions =
    dutyPackageOptions[selectedBookingType] || [];
  const showDutyPackage = selectedDutyPackageOptions.length > 0;
  const showPackageFields = selectedBookingType === "package";
  const showKmFields = selectedBillingModel === "rate_per_km";

  useEffect(() => {
    if (selectedBookingType === "outstation") {
      setValue("billing_model", "rate_per_km");
      return;
    }

    if (
      selectedBookingType === "package" ||
      selectedBookingType === "local" ||
      selectedBookingType === "airport_transfer" ||
      selectedBookingType === "railway_station_transfer"
    ) {
      setValue("billing_model", "fixed");
    }
  }, [selectedBookingType, setValue]);

  useEffect(() => {
    if (!showDutyPackage) {
      setValue("duty_package", "");
      return;
    }

    const currentPackage = watch("duty_package");
    if (
      !selectedDutyPackageOptions.some(
        (option) => option.value === currentPackage,
      )
    ) {
      setValue("duty_package", "");
    }
  }, [
    selectedBookingType,
    selectedDutyPackageOptions,
    setValue,
    showDutyPackage,
    watch,
  ]);

  useEffect(() => {
    if (!selectedCustomerId || !selectedCustomer) {
      setValue("traveller_id", "");
      return;
    }

    if (selectedCustomerType === "Individuals") {
      const retailTraveller = travellerOptions.find(
        (traveller) => traveller.customer_id === selectedCustomerId,
      );
      setValue("traveller_id", retailTraveller?.id || "");
      return;
    }

    const selectedTraveller = travellerOptions.find(
      (traveller) => traveller.id === selectedTravellerId,
    );
    if (selectedTraveller?.customer_id === selectedCustomerId) return;

    setValue("traveller_id", "");
  }, [
    selectedCustomerId,
    selectedCustomer,
    selectedCustomerType,
    selectedTravellerId,
    setValue,
    travellerOptions,
  ]);

  async function onSubmit(values) {
    try {
      const booking = isEditMode
        ? await updateBooking(existingBooking.id, values)
        : await createBooking(values);
      navigate("/bookings", {
        state: {
          notice: `Booking ${booking.id} ${isEditMode ? "updated" : "created"} successfully.`,
        },
      });
    } catch (error) {
      setLoadError(getBookingErrorMessage(error));
    }
  }

  async function handleSaveTraveller(newTraveller) {
    try {
      const traveller = await createCustomerTraveller(
        selectedCustomerId,
        newTraveller,
      );
      setTravellerOptions((current) => [...current, traveller]);
      setValue("traveller_id", traveller.id, { shouldValidate: true });
      setIsTravellerModalOpen(false);
    } catch (error) {
      setLoadError(getBookingErrorMessage(error));
    }
  }

  function handleCustomerTypeChange(customerType) {
    setValue("customer_type", customerType, { shouldValidate: true });
    setValue("billing_customer_id", "");
    setValue("traveller_id", "");
  }

  function handleBillingCustomerChange(customerId) {
    const customer = customerOptions.find((option) => option.id === customerId);
    setValue("billing_customer_id", customerId, { shouldValidate: true });
    setValue("customer_type", customer?.type || "", { shouldValidate: true });
    setValue("traveller_id", "");
  }

  async function handleSaveCustomer(newCustomer, newTraveller) {
    try {
      const customer = await createCustomer({
        ...newCustomer,
        salutation:
          newCustomer.salutation === "Mr."
            ? "MR"
            : newCustomer.salutation === "Ms."
              ? "MS"
              : null,
        name: newCustomer.name.replace(/^(Mr|Ms)\.\s+/i, ""),
        billingName: newCustomer.billingName,
        address: newCustomer.address || "",
      });
      let traveller = customer.travellers?.[0];
      if (!traveller && newTraveller?.name) {
        traveller = await createCustomerTraveller(customer.id, {
          ...newTraveller,
          salutation: newCustomer.salutation === "Ms." ? "MS" : "MR",
        });
      }
      setCustomerOptions((current) => [...current, customer]);
      if (traveller) setTravellerOptions((current) => [...current, traveller]);
      setValue("billing_customer_id", customer.id, { shouldValidate: true });
      setValue("customer_type", customer.type, { shouldValidate: true });
      setValue("traveller_id", traveller?.id || "", { shouldValidate: true });
      setIsCustomerModalOpen(false);
    } catch (error) {
      setLoadError(getBookingErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      {loadError && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </p>
      )}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading booking data…
        </div>
      ) : isEditMode && !existingBooking ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Booking not found.{" "}
          <Link className="font-semibold text-brand-600" to="/bookings">
            Back to bookings
          </Link>
        </div>
      ) : (
        <>
          <form
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-2">
              <p className="shrink-0 text-sm font-semibold text-slate-900">
                Billing and traveller
              </p>
              <span className="hidden text-xs text-slate-500 sm:inline">
                Customer billing party and traveller details
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input
                type="hidden"
                {...register("billing_customer_id", {
                  required: "Billing customer is required",
                })}
              />

              <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Customer Type
                  </span>
                  <select
                    className={fieldClass}
                    value={selectedCustomerType}
                    {...register("customer_type", {
                      required: "Customer type is required",
                      onChange: (event) =>
                        handleCustomerTypeChange(event.target.value),
                    })}
                  >
                    <option value="">Select customer type</option>
                    <option value="Individuals">Individuals</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Travel Agent">Travel Agent</option>
                  </select>
                  <FieldError message={errors.customer_type?.message} />
                </label>

                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <span className="text-sm font-medium text-slate-700">
                        Billing Customer
                      </span>
                      <select
                        className={fieldClass}
                        value={selectedCustomerId}
                        disabled={!selectedCustomerType}
                        onChange={(event) =>
                          handleBillingCustomerChange(event.target.value)
                        }
                      >
                        <option value="">
                          {selectedCustomerType
                            ? "Select billing customer"
                            : "Select customer type first"}
                        </option>
                        {filteredCustomers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.displayName} - {customer.type}
                            {customer.phone ? ` - ${customer.phone}` : ""}
                          </option>
                        ))}
                      </select>
                      <FieldError
                        message={errors.billing_customer_id?.message}
                      />
                    </label>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsCustomerModalOpen(true)}
                    >
                      <Plus size={16} />
                      New Customer
                    </button>
                  </div>

                  {selectedCustomer && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {selectedCustomer.type}
                      </span>
                      {selectedCustomer.city && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {selectedCustomer.city}
                        </span>
                      )}
                      {selectedCustomer.gstin && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          GST: {selectedCustomer.gstin}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {selectedCustomerType === "Individuals" && selectedCustomer && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-emerald-800">
                      Traveller
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      Individual booking traveller is the selected customer:{" "}
                      {selectedCustomer.displayName}.
                    </p>
                  </div>
                )}

                {shouldShowTravellerSelect && (
                  <div className="md:col-span-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1">
                        <span className="text-sm font-medium text-slate-700">
                          {travellerLabel}
                        </span>
                        <select
                          className={fieldClass}
                          disabled={!selectedCustomerId}
                          {...register("traveller_id", {
                            required: "Traveller is required",
                          })}
                        >
                          <option value="">
                            {selectedCustomerId
                              ? "Select traveller"
                              : "Select billing customer first"}
                          </option>
                          {filteredTravellers.map((traveller) => (
                            <option key={traveller.id} value={traveller.id}>
                              {traveller.name}
                              {traveller.employee_id
                                ? ` (${traveller.employee_id})`
                                : ""}
                            </option>
                          ))}
                        </select>
                        <FieldError message={errors.traveller_id?.message} />
                      </label>

                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!selectedCustomer}
                        onClick={() => setIsTravellerModalOpen(true)}
                      >
                        <Plus size={16} />
                        {addTravellerLabel}
                      </button>
                    </div>

                    {selectedCustomerId && filteredTravellers.length === 0 && (
                      <p className="mt-2 text-sm text-amber-700">
                        No active travellers found for this billing customer.
                        Add a new traveller to continue.
                      </p>
                    )}
                  </div>
                )}

                {!shouldShowTravellerSelect && (
                  <input type="hidden" {...register("traveller_id")} />
                )}
              </div>

              <div className="mt-1 flex items-center gap-3 border-b border-slate-200 pb-2 md:col-span-2 xl:col-span-3">
                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  Booking duty and route
                </p>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  Assignment can be completed after booking creation
                </span>
              </div>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Booking Type
                </span>
                <select
                  className={fieldClass}
                  {...register("booking_type", {
                    required: "Booking type is required",
                  })}
                >
                  <option value="">Select booking type</option>
                  {bookingTypeOptions.map((bookingType) => (
                    <option key={bookingType.value} value={bookingType.value}>
                      {bookingType.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.booking_type?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Assignment Source
                </span>
                <select
                  className={fieldClass}
                  {...register("assignmentType", {
                    required: "Assignment source is required",
                  })}
                >
                  <option value="own_vehicle">Own Vehicle</option>
                  <option value="vendor_vehicle">Vendor Vehicle</option>
                </select>
                <FieldError message={errors.assignmentType?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Type of Vehicle
                </span>
                <select
                  className={fieldClass}
                  {...register("requestedVehicleType", {
                    required: "Type of vehicle is required",
                  })}
                >
                  <option value="">Select vehicle type</option>
                  {requestedVehicleTypeOptions.map((vehicleType) => (
                    <option key={vehicleType} value={vehicleType}>
                      {vehicleType}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.requestedVehicleType?.message} />
              </label>

              {showDutyPackage && (
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    {selectedBookingType === "outstation"
                      ? "Outstation Minimum KM"
                      : "Duty Package"}
                  </span>
                  <select
                    className={fieldClass}
                    {...register("duty_package", {
                      required: "Duty package is required",
                    })}
                  >
                    <option value="">
                      {selectedBookingType === "outstation"
                        ? "Select minimum km per day"
                        : "Select duty package"}
                    </option>
                    {selectedDutyPackageOptions.map((dutyPackage) => (
                      <option key={dutyPackage.value} value={dutyPackage.value}>
                        {dutyPackage.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.duty_package?.message} />
                </label>
              )}

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Trip Type
                </span>
                <select
                  className={fieldClass}
                  {...register("trip_type", {
                    required: "Trip type is required",
                  })}
                >
                  <option value="one_way">One Way</option>
                  <option value="roundtrip">Round Trip</option>
                  <option value="multi_city">
                    Multi City / Multiple Visits
                  </option>
                </select>
                <FieldError message={errors.trip_type?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Start Date
                </span>
                <input
                  className={fieldClass}
                  type="date"
                  {...register("startDate", {
                    required: "Start date is required",
                  })}
                />
                <FieldError message={errors.startDate?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  End Date
                </span>
                <input
                  className={fieldClass}
                  type="date"
                  {...register("endDate", {
                    required: "End date is required",
                    validate: (value) => {
                      if (selectedStartDate && value < selectedStartDate)
                        return "End date cannot be before start date";
                      return true;
                    },
                  })}
                />
                <FieldError message={errors.endDate?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Pickup / Reporting Time
                </span>
                <input
                  className={fieldClass}
                  type="time"
                  {...register("pickupTime", {
                    required: "Pickup / reporting time is required",
                  })}
                />
                <FieldError message={errors.pickupTime?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Service City
                </span>
                <input
                  className={fieldClass}
                  placeholder="Prayagraj"
                  {...register("serviceCity", {
                    required: "Service city is required",
                    minLength: { value: 2, message: "Enter a valid city" },
                  })}
                />
                <FieldError message={errors.serviceCity?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Travelling From
                </span>
                <input
                  className={fieldClass}
                  placeholder="New Delhi"
                  {...register("travellingFrom", {
                    required: "Travelling from is required",
                    minLength: {
                      value: 3,
                      message: "Enter at least 3 characters",
                    },
                  })}
                />
                <FieldError message={errors.travellingFrom?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Travelling To
                </span>
                <input
                  className={fieldClass}
                  placeholder={
                    selectedTripType === "roundtrip"
                      ? "Same city return or final drop point"
                      : selectedTripType === "multi_city"
                        ? "Final drop point if known"
                        : isTransferBooking
                          ? "Airport / Railway Station / Hotel"
                          : "Grand Plaza Hotel"
                  }
                  {...register("travellingTo", {
                    validate: (value) => {
                      if (!value) return "Travelling to is required";
                      if (value && value.length < 3)
                        return "Enter at least 3 characters";
                      return true;
                    },
                  })}
                />
                <FieldError message={errors.travellingTo?.message} />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Pickup / Reporting Address / Location
                </span>
                <input
                  className={fieldClass}
                  placeholder="Airport Terminal 2, Arrival Gate"
                  {...register("pickupReportingAddress", {
                    required: "Pickup / reporting address is required",
                    minLength: {
                      value: 3,
                      message: "Enter at least 3 characters",
                    },
                  })}
                />
                <FieldError message={errors.pickupReportingAddress?.message} />
              </label>

              {selectedTripType === "multi_city" && (
                <label className="md:col-span-2 xl:col-span-3">
                  <span className="text-sm font-medium text-slate-700">
                    Route / City Stops
                  </span>
                  <textarea
                    className={`${fieldClass} min-h-24 resize-y`}
                    placeholder="Example: Delhi > Agra > Jaipur > Delhi"
                    {...register("routeStops", {
                      required:
                        "Route stops are required for multi city booking",
                      minLength: { value: 5, message: "Enter route details" },
                    })}
                  />
                  <FieldError message={errors.routeStops?.message} />
                </label>
              )}

              {showPackageFields && (
                <label className="md:col-span-2 xl:col-span-3">
                  <span className="text-sm font-medium text-slate-700">
                    Package Details
                  </span>
                  <textarea
                    className={`${fieldClass} min-h-24 resize-y`}
                    placeholder="Example: 2 days Delhi local sightseeing package"
                    {...register("packageDetails", {
                      required: "Package details are required",
                      minLength: { value: 5, message: "Enter package details" },
                    })}
                  />
                  <FieldError message={errors.packageDetails?.message} />
                </label>
              )}

              <div className="mt-1 flex items-center gap-3 border-b border-slate-200 pb-2 md:col-span-2 xl:col-span-3">
                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  Pricing
                </p>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  Fixed amount or rate per km
                </span>
              </div>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Pricing Basis
                </span>
                <select
                  className={fieldClass}
                  {...register("billing_model", {
                    required: "Pricing basis is required",
                  })}
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="rate_per_km">Rate Per Km</option>
                </select>
                <FieldError message={errors.billing_model?.message} />
              </label>

              {!showKmFields && (
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    {showPackageFields
                      ? "Package Fixed Amount"
                      : "Fixed Amount"}
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    min="1"
                    placeholder="5000"
                    {...register("fixedAmount", {
                      required: "Fixed amount is required",
                      valueAsNumber: true,
                      min: {
                        value: 1,
                        message: "Amount must be greater than 0",
                      },
                    })}
                  />
                  <FieldError message={errors.fixedAmount?.message} />
                </label>
              )}

              {showKmFields && (
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Rate Per Km
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    min="1"
                    placeholder="18"
                    {...register("ratePerKm", {
                      required: "Rate per km is required",
                      valueAsNumber: true,
                      min: { value: 1, message: "Rate must be greater than 0" },
                    })}
                  />
                  <FieldError message={errors.ratePerKm?.message} />
                </label>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                    {...register("supportingDocumentsRequired", {
                      onChange: (event) => {
                        if (!event.target.checked)
                          setValue("requiredDutyDocuments", [], {
                            shouldValidate: true,
                          });
                      },
                    })}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Supporting documents required at duty completion
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      The selected documents will be mandatory before this duty
                      can be completed.
                    </span>
                  </span>
                </label>

                {supportingDocumentsRequired && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={
                          selectedRequiredDutyDocuments.length ===
                          requiredDutyDocumentOptions.length
                        }
                        onChange={(event) =>
                          setValue(
                            "requiredDutyDocuments",
                            event.target.checked
                              ? requiredDutyDocumentOptions.map(
                                  (option) => option.value,
                                )
                              : [],
                            { shouldValidate: true, shouldDirty: true },
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      Select All
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {requiredDutyDocumentOptions.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            value={option.value}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
                            {...register("requiredDutyDocuments", {
                              validate: (value, values) =>
                                !values.supportingDocumentsRequired ||
                                value?.length > 0 ||
                                "Select at least one supporting document",
                            })}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    <FieldError
                      message={errors.requiredDutyDocuments?.message}
                    />
                  </div>
                )}
              </div>

              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-sm font-medium text-slate-700">
                  Notes
                </span>
                <textarea
                  className={`${fieldClass} min-h-28 resize-y`}
                  placeholder="Add any trip instructions or billing notes"
                  {...register("notes", {
                    maxLength: {
                      value: 240,
                      message: "Notes must be 240 characters or less",
                    },
                  })}
                />
                <FieldError message={errors.notes?.message} />
              </label>
            </div>

            {isSubmitSuccessful && (
              <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Booking details validated successfully.
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/bookings"
                className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                {isEditMode ? "Update Booking" : "Create Booking"}
              </button>
            </div>
          </form>

          {isTravellerModalOpen && selectedCustomer && (
            <AddTravellerModal
              customer={selectedCustomer}
              customerType={selectedCustomerType}
              onClose={() => setIsTravellerModalOpen(false)}
              onSave={handleSaveTraveller}
            />
          )}
          {isCustomerModalOpen && (
            <AddCustomerModal
              onClose={() => setIsCustomerModalOpen(false)}
              onSave={handleSaveCustomer}
            />
          )}
        </>
      )}
    </div>
  );
}

export default BookingFormPage;
