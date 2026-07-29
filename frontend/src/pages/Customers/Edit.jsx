import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCustomer, getCustomerErrorMessage } from "../../services/customers";
import CustomerForm from "./components/CustomerForm";

function CustomerEditPage() {
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

  return (
    <div className="space-y-5">
      <CustomerForm customer={customer} mode="edit" />
    </div>
  );
}

export default CustomerEditPage;
