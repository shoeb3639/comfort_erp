import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import InvoicePreviewTemplate from "./components/InvoicePreviewTemplate";
import { getInvoice } from "../../services/invoices";
import { normalizeInvoice } from "./invoiceUtils";

function InvoicePreviewPage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoice(invoiceId)
      .then((record) => setInvoice(normalizeInvoice(record)))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm">Loading invoice…</div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Invoice not found.{" "}
        <Link className="font-semibold text-brand-600" to="/invoices">
          Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end print:hidden">
        <Link
          to="/invoices"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Back to Invoices
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <InvoicePreviewTemplate invoice={invoice} />
      </div>
    </div>
  );
}

export default InvoicePreviewPage;
