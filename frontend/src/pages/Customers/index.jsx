import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Eye, Pencil, Search, UserPlus, X } from "lucide-react";
import {
  createCustomerTraveller,
  getCustomerErrorMessage,
  getCustomers,
  updateCustomerTraveller,
} from "../../services/customers";
import CustomerTypeBadge from "./components/CustomerTypeBadge";
import ActionNotice from "../../components/ActionNotice";
import Pagination from "../../components/Pagination";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

function AddEmployeeModal({ customer, employee, onClose, onSave }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      salutation: employee?.salutation || "",
      name: employee?.name || "",
      phone: employee?.phone || "",
      email: employee?.email || "",
      department: employee?.department || "",
      employee_id: employee?.employee_id || "",
      notes: employee?.notes || "",
    },
  });

  function onSubmit(values) {
    onSave({
      id: employee?.id,
      customer_id: customer.id,
      traveller_type: customer.type === "Travel Agent" ? "Guest" : "Employee",
      salutation: values.salutation,
      name: values.name,
      phone: values.phone,
      email: values.email,
      department: values.department,
      employee_id: values.employee_id,
      notes: values.notes,
      status: "Active",
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {employee ? "Edit Employee" : "Add Employee"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {customer.displayName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close add employee modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Salutation
              </span>
              <select className={fieldClass} {...register("salutation")}>
                <option value="">No salutation</option>
                <option value="MR">Mr.</option>
                <option value="MS">Ms.</option>
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Employee Name
              </span>
              <input
                className={fieldClass}
                placeholder="Mr. X"
                {...register("name", {
                  required: "Employee name is required",
                  minLength: {
                    value: 2,
                    message: "Enter at least 2 characters",
                  },
                })}
              />
              <FieldError message={errors.name?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Mobile Number
              </span>
              <input
                className={fieldClass}
                placeholder="+91 98765 43210"
                {...register("phone", {
                  required: "Mobile number is required",
                  minLength: {
                    value: 8,
                    message: "Enter a valid mobile number",
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
                placeholder="employee@company.com"
                {...register("email", {
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: "Enter a valid email",
                  },
                })}
              />
              <FieldError message={errors.email?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Employee ID
              </span>
              <input
                className={fieldClass}
                placeholder="Optional"
                {...register("employee_id")}
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Department
              </span>
              <input
                className={fieldClass}
                placeholder="Travel Desk, Admin"
                {...register("department")}
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className={`${fieldClass} min-h-20 resize-y`}
                placeholder="Booking preference or remarks"
                {...register("notes")}
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
              {employee ? "Update Employee" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeViewModal({ employee, onClose, onEdit }) {
  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {employee.displayName || employee.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {employee.employee_id || "No employee ID"}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <DetailItem label="Mobile" value={employee.phone} />
          <DetailItem label="Email" value={employee.email} />
          <DetailItem label="Department" value={employee.department} />
          <DetailItem label="Status" value={employee.status} />
          <div className="sm:col-span-2">
            <DetailItem label="Notes" value={employee.notes} />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => onEdit(employee)}
          >
            <Pencil size={16} />
            Edit Employee
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailModal({
  customer,
  travellers,
  onClose,
  onAddEmployee,
  onViewEmployee,
  onEditEmployee,
}) {
  if (!customer) return null;

  const linkedTravellers = travellers.filter(
    (traveller) => traveller.customer_id === customer.id,
  );
  const peopleLabel =
    customer.type === "Travel Agent"
      ? "Guests"
      : customer.type === "Corporate"
        ? "Employees"
        : "Travellers";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-slate-900">
                {customer.displayName}
              </h3>
              <CustomerTypeBadge type={customer.type} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {customer.billingName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {customer.type === "Corporate" && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                onClick={() => onAddEmployee(customer)}
              >
                <UserPlus size={16} />
                Add Employee
              </button>
            )}
            <Link
              to={`/customers/${customer.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Pencil size={16} />
              Edit
            </Link>
            <button
              type="button"
              aria-label="Close customer details"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone} />
            <DetailItem label="City" value={customer.city} />
            <DetailItem
              label="GSTIN"
              value={customer.gstin || "Not applicable"}
            />
            <DetailItem
              label="Credit Limit"
              value={`₹${Number(customer.creditLimit || 0).toLocaleString()}`}
            />
            <DetailItem
              label="Outstanding"
              value={`₹${Number(customer.outstanding || 0).toLocaleString()}`}
            />
            <DetailItem
              label="Bookings"
              value={customer.bookings?.length || 0}
            />
            <DetailItem
              label="Invoices"
              value={customer.invoices?.length || 0}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Billing Address
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {customer.address || "-"}
              </p>
            </div>
          </div>

          <div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {peopleLabel}
                </p>
                {customer.type === "Corporate" && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => onAddEmployee(customer)}
                  >
                    <UserPlus size={14} />
                    Add
                  </button>
                )}
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                {linkedTravellers.length ? (
                  <table className="w-full min-w-[900px] table-auto divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Employee ID
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Mobile
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Email
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Department
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Status
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {linkedTravellers.map((traveller) => (
                        <tr key={traveller.id}>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {traveller.displayName || traveller.name}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {traveller.employee_id || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {traveller.phone || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {traveller.email || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {traveller.department || "-"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                traveller.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {traveller.status || "Active"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                                onClick={() => onViewEmployee(traveller)}
                              >
                                <Eye size={14} />
                                View
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                                onClick={() => onEditEmployee(traveller)}
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No {peopleLabel.toLowerCase()} added.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [travellers, setTravellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [employeeCustomer, setEmployeeCustomer] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
    hasPrevious: false,
    hasNext: false,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(
      () =>
        getCustomers({
          page: pagination.page,
          limit: pagination.limit,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(typeFilter !== "All"
            ? {
                type:
                  typeFilter === "Individuals"
                    ? "RETAIL"
                    : typeFilter === "Travel Agent"
                      ? "TRAVEL_AGENT"
                      : "CORPORATE",
              }
            : {}),
        })
          .then((result) => {
            if (!active) return;
            setCustomers(result.items);
            setPagination(result.pagination);
            setTravellers(
              result.items.flatMap((customer) => customer.travellers || []),
            );
          })
          .catch((requestError) => {
            if (active) setNotice(getCustomerErrorMessage(requestError));
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pagination.page, pagination.limit, search, typeFilter]);

  const travellersByCustomerId = useMemo(() => {
    return travellers.reduce((groups, traveller) => {
      const currentGroup = groups.get(traveller.customer_id) || [];
      currentGroup.push(traveller);
      groups.set(traveller.customer_id, currentGroup);
      return groups;
    }, new Map());
  }, [travellers]);

  async function handleAddEmployee(employee) {
    try {
      const saved = await createCustomerTraveller(
        employee.customer_id,
        employee,
      );
      setTravellers((currentTravellers) => [saved, ...currentTravellers]);
      const customer = customers.find(
        (item) => item.id === employee.customer_id,
      );
      if (customer) {
        const updatedCustomer = {
          ...customer,
          travellers: [saved, ...(customer.travellers || [])],
        };
        setCustomers((currentCustomers) =>
          currentCustomers.map((item) =>
            item.id === customer.id ? updatedCustomer : item,
          ),
        );
        setSelectedCustomer(updatedCustomer);
        setNotice(
          `${saved.displayName || saved.name} added to ${customer.displayName}.`,
        );
      }
      setEmployeeCustomer(null);
    } catch (requestError) {
      setNotice(getCustomerErrorMessage(requestError));
    }
  }

  async function handleUpdateEmployee(employee) {
    try {
      const saved = await updateCustomerTraveller(
        employee.customer_id,
        employee.id,
        employee,
      );
      setTravellers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === saved.customer_id
            ? {
                ...customer,
                travellers: (customer.travellers || []).map((item) =>
                  item.id === saved.id ? saved : item,
                ),
              }
            : customer,
        ),
      );
      setSelectedCustomer((customer) =>
        customer?.id === saved.customer_id
          ? {
              ...customer,
              travellers: (customer.travellers || []).map((item) =>
                item.id === saved.id ? saved : item,
              ),
            }
          : customer,
      );
      setEditingEmployee(null);
      setNotice(`${saved.displayName || saved.name} updated.`);
    } catch (requestError) {
      setNotice(getCustomerErrorMessage(requestError));
    }
  }

  return (
    <div className="space-y-5">
      <ActionNotice message={notice} onDismiss={() => setNotice("")} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Customer List
          </h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_220px]">
            <label className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
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
                placeholder="Search name, billing name, email, city"
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All customer types</option>
              <option value="Individuals">Individuals</option>
              <option value="Corporate">Corporate</option>
              <option value="Travel Agent">Travel Agent</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1150px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Contact
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  City
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!loading &&
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {customer.displayName}
                      </p>
                      <p className="text-slate-500">{customer.billingName}</p>
                      {customer.type === "Corporate" && (
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          {
                            (travellersByCustomerId.get(customer.id) || [])
                              .length
                          }{" "}
                          employees
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CustomerTypeBadge type={customer.type} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{customer.email}</p>
                      <p className="text-slate-400">{customer.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {customer.city}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      ₹{customer.outstanding.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`View ${customer.displayName}`}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-600 hover:bg-slate-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedCustomer(customer);
                          }}
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <Link
                          to={`/customers/${customer.id}/edit`}
                          aria-label={`Edit ${customer.displayName}`}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-600 hover:bg-slate-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Pencil size={16} />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {loading && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              Loading customers...
            </div>
          )}
          {!loading && customers.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              No customers found.
            </div>
          )}
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
      </section>

      <CustomerDetailModal
        customer={selectedCustomer}
        travellers={travellers}
        onClose={() => setSelectedCustomer(null)}
        onAddEmployee={setEmployeeCustomer}
        onViewEmployee={setSelectedEmployee}
        onEditEmployee={setEditingEmployee}
      />
      <EmployeeViewModal
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onEdit={(employee) => {
          setSelectedEmployee(null);
          setEditingEmployee(employee);
        }}
      />
      {employeeCustomer && (
        <AddEmployeeModal
          customer={employeeCustomer}
          onClose={() => setEmployeeCustomer(null)}
          onSave={handleAddEmployee}
        />
      )}
      {editingEmployee && selectedCustomer && (
        <AddEmployeeModal
          customer={selectedCustomer}
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSave={handleUpdateEmployee}
        />
      )}
    </div>
  );
}

export default CustomersPage;
