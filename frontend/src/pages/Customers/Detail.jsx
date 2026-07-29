import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCustomer, getCustomerErrorMessage } from "../../services/customers";
import CustomerTypeBadge from "./components/CustomerTypeBadge";

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ label }) {
  return (
    <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {label}
    </p>
  );
}

function CustomerDetailPage() {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCustomer(customerId)
      .then((record) => {
        if (active) setCustomer(record);
      })
      .catch((requestError) => {
        if (active) setError(getCustomerErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading customer...</p>;
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {error || "Customer not found."}{" "}
        <Link className="font-semibold text-brand-600" to="/customers">
          Back to customers
        </Link>
      </div>
    );
  }

  const linkedTravellers = customer.travellers || [];
  const peopleLabel =
    customer.type === "Travel Agent"
      ? "Guests"
      : customer.type === "Corporate"
        ? "Employees"
        : "Travellers";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            <p className="mt-2 text-sm text-slate-600">{customer.address}</p>
          </div>
          <Link
            to={`/customers/${customer.id}/edit`}
            className="inline-flex justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Edit Customer
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Section
          title={
            customer.type === "Individuals"
              ? "Customer Details"
              : "Company / Agent Details"
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-slate-500">City</dt>
              <dd className="font-medium text-slate-900">{customer.city}</dd>
            </div>
            <div>
              <dt className="text-slate-500">GSTIN</dt>
              <dd className="font-medium text-slate-900">
                {customer.gstin || "Not applicable"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Credit Limit</dt>
              <dd className="font-medium text-slate-900">
                ₹{customer.creditLimit.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Outstanding</dt>
              <dd className="font-medium text-slate-900">
                ₹{customer.outstanding.toLocaleString()}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Contacts">
          <div className="space-y-3">
            {customer.contacts.map((contact) => (
              <div
                key={`${contact.name}-${contact.role}`}
                className="rounded-xl border border-slate-200 p-4 text-sm"
              >
                <p className="font-semibold text-slate-900">
                  {contact.displayName || contact.name}
                </p>
                <p className="text-slate-500">{contact.role}</p>
                <p className="mt-2 text-slate-600">{contact.phone}</p>
                <p className="text-slate-600">{contact.email}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={peopleLabel}>
          {linkedTravellers.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Name
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {linkedTravellers.map((traveller) => (
                    <tr key={traveller.id}>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {traveller.displayName || traveller.name}
                        {traveller.employee_id ? (
                          <span className="ml-1 text-xs font-medium text-slate-400">
                            ({traveller.employee_id})
                          </span>
                        ) : null}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label={`No ${peopleLabel.toLowerCase()} added yet.`} />
          )}
        </Section>

        <Section title="Rate Cards">
          <div className="space-y-3">
            {customer.rateCards.map((rateCard) => (
              <div
                key={rateCard.name}
                className="rounded-xl border border-slate-200 p-4 text-sm"
              >
                <p className="font-semibold text-slate-900">{rateCard.name}</p>
                <p className="text-slate-500">{rateCard.vehicleType}</p>
                <p className="mt-2 text-slate-600">
                  Base ₹{rateCard.baseRate} • Extra km ₹{rateCard.extraKm}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Bookings">
          {customer.bookings.length ? (
            <div className="flex flex-wrap gap-2">
              {customer.bookings.map((booking) => (
                <span
                  key={booking}
                  className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700"
                >
                  {booking}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState label="No bookings linked yet." />
          )}
        </Section>

        <Section title="Invoices">
          {customer.invoices.length ? (
            <div className="flex flex-wrap gap-2">
              {customer.invoices.map((invoice) => (
                <span
                  key={invoice}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {invoice}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState label="No invoices raised yet." />
          )}
        </Section>

        <Section title="Payments">
          {customer.payments.length ? (
            <div className="space-y-3">
              {customer.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between rounded-xl border border-slate-200 p-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{payment.id}</p>
                    <p className="text-slate-500">{payment.mode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      ₹{payment.amount.toLocaleString()}
                    </p>
                    <p className="text-slate-500">{payment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No payments recorded yet." />
          )}
        </Section>

        <Section title="Documents">
          <div className="space-y-3">
            {customer.documents.map((document) => (
              <div
                key={document.name}
                className="flex justify-between rounded-xl border border-slate-200 p-4 text-sm"
              >
                <p className="font-semibold text-slate-900">{document.name}</p>
                <p className="text-slate-500">{document.status}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

export default CustomerDetailPage;
