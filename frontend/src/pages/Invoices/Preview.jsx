import { Link, useParams } from 'react-router-dom'
import InvoicePreviewTemplate from './components/InvoicePreviewTemplate'
import { getInvoiceById } from './invoiceUtils'

function InvoicePreviewPage() {
  const { invoiceId } = useParams()
  const invoice = getInvoiceById(invoiceId)

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Invoice not found. <Link className="font-semibold text-brand-600" to="/invoices">Back to invoices</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end print:hidden">
        <Link
          to={`/invoices/${invoice.id}/edit`}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Edit Invoice
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <InvoicePreviewTemplate invoice={invoice} />
      </div>
    </div>
  )
}

export default InvoicePreviewPage
