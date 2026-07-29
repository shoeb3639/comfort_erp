import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import InvoicePreviewTemplate from "./components/InvoicePreviewTemplate";
import { getInvoice } from "../../services/invoices";
import { normalizeInvoice } from "./invoiceUtils";

function InvoicePrintPage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoice(invoiceId)
      .then((record) => setInvoice(normalizeInvoice(record)))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  useEffect(() => {
    if (invoice) {
      window.setTimeout(() => window.print(), 250);
    }
  }, [invoice]);

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
    <div className="space-y-5 print:space-y-0">
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <InvoicePreviewTemplate invoice={invoice} />
      </div>
    </div>
  );
}

export default InvoicePrintPage;
