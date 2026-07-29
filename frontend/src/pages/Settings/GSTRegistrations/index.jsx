import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createGstRegistration,
  getGstRegistrations,
  getLocations,
  getSetupErrorMessage,
  updateGstRegistration,
} from "../../../services/tenantSetup";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const empty = {
  registrationName: "",
  legalName: "",
  tradeName: "",
  registrationType: "Regular",
  gstin: "",
  pan: "",
  registeredAddress: "",
  city: "",
  district: "",
  state: "",
  stateCode: "",
  pinCode: "",
  country: "India",
  effectiveFrom: "",
  effectiveTo: "",
  isDefault: false,
  status: "ACTIVE",
  notes: "",
  locationIds: [],
};

function Field({ label, onChange, ...props }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function normalize(record) {
  return {
    ...empty,
    ...record,
    effectiveFrom: record.effectiveFrom?.slice(0, 10) || "",
    effectiveTo: record.effectiveTo?.slice(0, 10) || "",
    locationIds: record.locations?.map((item) => item.location.id) || [],
  };
}

function GSTRegistrationsPage() {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const isForm =
    routeLocation.pathname.endsWith("/new") ||
    routeLocation.pathname.endsWith("/edit");
  const [records, setRecords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [values, setValues] = useState(empty);
  const [error, setError] = useState("");

  async function load() {
    const [registrationData, locationData] = await Promise.all([
      getGstRegistrations(),
      getLocations(),
    ]);
    setRecords(registrationData);
    setLocations(locationData);
    if (registrationId) {
      const record = registrationData.find(
        (item) => item.id === registrationId,
      );
      if (record) setValues(normalize(record));
    }
  }

  useEffect(() => {
    load().catch((requestError) =>
      setError(getSetupErrorMessage(requestError)),
    );
  }, [registrationId]);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const payload = {
      ...values,
      gstin: values.gstin || null,
      pan: values.pan || null,
      effectiveFrom: values.effectiveFrom || null,
      effectiveTo: values.effectiveTo || null,
    };
    try {
      if (registrationId) await updateGstRegistration(registrationId, payload);
      else await createGstRegistration(payload);
      navigate("/settings/gst-registrations");
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  if (!isForm) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">
              GST Registrations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Database-backed GST identities and branch mapping.
            </p>
          </div>
          <Link
            to="/settings/gst-registrations/new"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Registration
          </Link>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {[
                  "Registration",
                  "GSTIN",
                  "State",
                  "Type",
                  "Locations",
                  "Default",
                  "Status",
                  "Actions",
                ].map((item) => (
                  <th key={item} className="px-4 py-3">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.registrationName}</p>
                    <p className="text-xs text-slate-500">{item.legalName}</p>
                  </td>
                  <td className="px-4 py-3">{item.gstin || "Unregistered"}</td>
                  <td className="px-4 py-3">
                    {item.state} ({item.stateCode})
                  </td>
                  <td className="px-4 py-3">{item.registrationType}</td>
                  <td className="px-4 py-3">
                    {item.locations
                      .map((row) => row.location.name)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">{item.isDefault ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-brand-600"
                      to={`/settings/gst-registrations/${item.id}/edit`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">
            {registrationId ? "Edit" : "Add"} GST Registration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            GSTIN is required for Regular and Composition registrations.
          </p>
        </div>
        <Link
          to="/settings/gst-registrations"
          className="text-sm font-semibold text-slate-600"
        >
          Cancel
        </Link>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Registration Name"
            required
            value={values.registrationName}
            onChange={(value) => update("registrationName", value)}
          />
          <Field
            label="Legal Business Name"
            required
            value={values.legalName}
            onChange={(value) => update("legalName", value)}
          />
          <Field
            label="Trade Name"
            value={values.tradeName || ""}
            onChange={(value) => update("tradeName", value)}
          />
          <label>
            <span className="text-sm font-medium text-slate-700">
              Registration Type
            </span>
            <select
              className={fieldClass}
              value={values.registrationType}
              onChange={(event) =>
                update("registrationType", event.target.value)
              }
            >
              {["Regular", "Composition", "Unregistered", "Other"].map(
                (type) => (
                  <option key={type}>{type}</option>
                ),
              )}
            </select>
          </label>
          <Field
            label="GSTIN"
            value={values.gstin || ""}
            onChange={(value) => update("gstin", value.toUpperCase())}
          />
          <Field
            label="PAN"
            value={values.pan || ""}
            onChange={(value) => update("pan", value.toUpperCase())}
          />
          <Field
            label="State"
            required
            value={values.state}
            onChange={(value) => update("state", value)}
          />
          <Field
            label="State Code"
            required
            value={values.stateCode}
            onChange={(value) => update("stateCode", value)}
          />
          <Field
            label="City"
            value={values.city || ""}
            onChange={(value) => update("city", value)}
          />
          <Field
            label="PIN Code"
            value={values.pinCode || ""}
            onChange={(value) => update("pinCode", value)}
          />
          <Field
            label="Effective From"
            type="date"
            value={values.effectiveFrom}
            onChange={(value) => update("effectiveFrom", value)}
          />
          <Field
            label="Effective To"
            type="date"
            value={values.effectiveTo}
            onChange={(value) => update("effectiveTo", value)}
          />
          <label className="md:col-span-2 xl:col-span-3">
            <span className="text-sm font-medium text-slate-700">
              Registered Address
            </span>
            <textarea
              className={fieldClass}
              value={values.registeredAddress || ""}
              onChange={(event) =>
                update("registeredAddress", event.target.value)
              }
            />
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className="text-sm font-medium text-slate-700">
              Assigned Locations
            </span>
            <div className="mt-2 flex flex-wrap gap-3">
              {locations.map((locationItem) => (
                <label
                  key={locationItem.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={values.locationIds.includes(locationItem.id)}
                    onChange={(event) =>
                      update(
                        "locationIds",
                        event.target.checked
                          ? [...values.locationIds, locationItem.id]
                          : values.locationIds.filter(
                              (id) => id !== locationItem.id,
                            ),
                      )
                    }
                  />
                  {locationItem.name}
                </label>
              ))}
            </div>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.isDefault}
              onChange={(event) => update("isDefault", event.target.checked)}
            />
            Default GST registration
          </label>
        </div>
      </section>
      <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
        Save GST Registration
      </button>
    </form>
  );
}

export default GSTRegistrationsPage;
