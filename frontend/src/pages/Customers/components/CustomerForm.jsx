import { useForm } from "react-hook-form";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCustomer,
  getCustomerErrorMessage,
  updateCustomer,
} from "../../../services/customers";
import ActionNotice from "../../../components/ActionNotice";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function FieldError({ message }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

function CustomerForm({ customer, mode = "create" }) {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      type: customer?.type || "",
      salutation: customer?.salutation || "",
      name: customer?.name || "",
      billingName: customer?.billingName || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      city: customer?.city || "",
      gstin: customer?.gstin || "",
      address: customer?.address || "",
      creditLimit: customer?.creditLimit || 0,
    },
  });

  async function onSubmit(values) {
    setError("");
    setNotice("");
    try {
      const saved =
        mode === "edit"
          ? await updateCustomer(customer.id, {
              ...values,
              status: customer.status,
              contacts: (customer.contacts || []).map((contact, index) =>
                contact.isPrimary || index === 0
                  ? {
                      ...contact,
                      salutation: values.salutation || null,
                      name: values.name,
                      phone: values.phone,
                      email: values.email,
                      isPrimary: true,
                    }
                  : contact,
              ),
            })
          : await createCustomer(values);
      setNotice(
        `Customer ${mode === "edit" ? "updated" : "created"} successfully.`,
      );
      window.setTimeout(() => navigate(`/customers/${saved.id}`), 500);
    } catch (requestError) {
      setError(getCustomerErrorMessage(requestError));
    }
  }

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <ActionNotice message={notice} />
      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-slate-700">
            Customer Type
          </span>
          <select
            className={fieldClass}
            {...register("type", { required: "Customer type is required" })}
          >
            <option value="">Select type</option>
            <option value="Individuals">Individuals</option>
            <option value="Corporate">Corporate</option>
            <option value="Travel Agent">Travel Agent</option>
          </select>
          <FieldError message={errors.type?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">
            Salutation (for a person)
          </span>
          <select className={fieldClass} {...register("salutation")}>
            <option value="">No salutation</option>
            <option value="MR">Mr.</option>
            <option value="MS">Ms.</option>
          </select>
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">
            Customer / Company Name
          </span>
          <input
            className={fieldClass}
            placeholder="Amit Sharma, Infosys, B4T Holidays"
            {...register("name", {
              required: "Customer name is required",
              minLength: { value: 2, message: "Enter at least 2 characters" },
            })}
          />
          <FieldError message={errors.name?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">
            Billing Name
          </span>
          <input
            className={fieldClass}
            placeholder="Legal billing name"
            {...register("billingName", {
              required: "Billing name is required",
              minLength: { value: 2, message: "Enter at least 2 characters" },
            })}
          />
          <FieldError message={errors.billingName?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            className={fieldClass}
            type="email"
            placeholder="Optional billing email"
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
          <span className="text-sm font-medium text-slate-700">Phone</span>
          <input
            className={fieldClass}
            placeholder="+91 98765 43210"
            {...register("phone", {
              required: "Phone is required",
              minLength: { value: 8, message: "Enter a valid phone number" },
            })}
          />
          <FieldError message={errors.phone?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">City</span>
          <input
            className={fieldClass}
            placeholder="Optional city"
            {...register("city")}
          />
          <FieldError message={errors.city?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">GSTIN</span>
          <input
            className={fieldClass}
            placeholder="Optional for Individuals"
            {...register("gstin")}
          />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">
            Credit Limit
          </span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            {...register("creditLimit", {
              valueAsNumber: true,
              min: { value: 0, message: "Credit limit cannot be negative" },
            })}
          />
          <FieldError message={errors.creditLimit?.message} />
        </label>

        <label className="md:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Billing Address
          </span>
          <textarea
            className={`${fieldClass} min-h-24 resize-y`}
            placeholder="Optional billing address"
            {...register("address")}
          />
          <FieldError message={errors.address?.message} />
        </label>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to="/customers"
          className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          disabled={isSubmitting}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving..."
            : mode === "edit"
              ? "Update Customer"
              : "Create Customer"}
        </button>
      </div>
    </form>
  );
}

export default CustomerForm;
