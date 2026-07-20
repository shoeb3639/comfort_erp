import { companyDetails, formatMoney, getInvoiceSettings } from '../invoiceUtils'
import { formatServicePeriod } from './InvoiceItemTable'
import { InvoiceLogo, InvoiceSignature } from './InvoiceVisuals'

function cleanMoney(value) {
  return formatMoney(value).replace('.00', '')
}

function amount(value) {
  return `₹ ${cleanMoney(value)}/-`
}

function formatDate(value) {
  if (!value) return ''
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}-${month}-${year}` : value
}

function formatPeriod(item) {
  if (item.dateType === 'range') {
    return [formatDate(item.serviceStartDate), formatDate(item.serviceEndDate)].filter(Boolean).join(' to ')
  }

  return formatDate(formatServicePeriod(item))
}

function ServicePeriod({ item }) {
  if (item.dateType === 'range') {
    const startDate = formatDate(item.serviceStartDate)
    const endDate = formatDate(item.serviceEndDate)

    if (startDate && endDate) {
      return (
        <>
          <span className="block whitespace-nowrap">{startDate} to</span>
          <span className="block whitespace-nowrap">{endDate}</span>
        </>
      )
    }
  }

  return <span className="whitespace-nowrap">{formatPeriod(item) || '-'}</span>
}

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className={`grid grid-cols-[63%_37%] items-center border-t ${strong ? 'border-b border-black font-bold' : 'border-slate-300 font-medium'}`}>
      <div className="px-3 py-1 text-right">{label}</div>
      <div className="min-w-0 whitespace-nowrap border-l border-slate-300 px-2 py-1 text-right text-[13px]">{amount(value)}</div>
    </div>
  )
}

function InvoicePreviewTemplate({ invoice }) {
  const settings = getInvoiceSettings()
  const totals = invoice.totals || {}
  const bank = invoice.bankDetails || {}
  const logoUrl = invoice.logoUrl || settings.logoUrl
  const signatureUrl = invoice.signatureUrl || settings.signatureUrl
  const hsnCode = invoice.hsnCode || settings.hsnCode
  const vehicle = invoice.vehicle || 'Not assigned'
  const isDirectInvoice = (invoice.invoice_source || invoice.invoiceSource) === 'direct'
  const serviceCity = invoice.serviceCity || invoice.service_city || invoice.placeOfSupply || '-'
  const bookingOrReference = isDirectInvoice ? invoice.referenceNumber || invoice.reference_number || '-' : invoice.bookingId || '-'

  return (
    <article className="mx-auto min-h-[297mm] w-[210mm] max-w-full border border-[#ddd] bg-white px-[42px] pb-[36px] pt-[42px] font-['Lato',Arial,Helvetica,sans-serif] text-[14px] font-normal leading-[1.5] text-black print:min-h-[297mm] print:w-[210mm] print:max-w-none print:px-[42px] print:pb-[36px] print:pt-[42px]">
      <div className="border border-black">
        <div className="grid grid-cols-3 items-center border-b border-black px-3 py-2.5 leading-[1.5]">
          <div className="text-[13px] font-bold normal-case tracking-normal">
            Invoice No.: {invoice.invoiceNumber}
          </div>
          <div className="text-center font-extrabold uppercase tracking-wide">Tax Invoice</div>
          <div />
        </div>

        <header className="grid grid-cols-[64%_36%] border-b border-black">
          <div className="grid grid-cols-[132px_1fr] gap-x-3 gap-y-2 px-3 pb-1.5 pt-3">
            <div className="row-span-1">
              <InvoiceLogo src={logoUrl} className="h-[116px] w-[116px] object-contain" />
            </div>
            <div className="text-[14px] font-medium leading-[1.5]">
              <h1 className="whitespace-nowrap text-[34px] font-extrabold leading-[1.15] tracking-wide">{companyDetails.name}</h1>
              <p className="mt-1">{companyDetails.address}</p>
              <p>{companyDetails.website}</p>
              <p>{companyDetails.mobile}</p>
              
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-x-4 border-t border-black/30 pt-1 text-[14px] font-bold leading-[1.5]">
              <p>GSTIN : {companyDetails.gstNumber}</p>
              <p className="text-right">HSN CODE: {hsnCode}</p>
            </div>
          </div>
          <div className="border-l border-black px-4 py-3 leading-[1.5]">
            <p className="font-bold uppercase">BILL TO</p>
            <p className="mt-1.5 font-medium">{invoice.billingName || invoice.traveller || invoice.billingCustomer}</p>
            <p className="mt-1 font-semibold uppercase">{invoice.billingCustomer}</p>
            <p className="mt-1 uppercase">{invoice.billingAddress || 'Billing address not available'}</p>
            <p className="mt-1.5 font-bold">GST No: {invoice.customerGstin || 'Not applicable'}</p>
          </div>
        </header>

        <section className="grid grid-cols-4 border-b border-black text-[13px] leading-[1.4]">
          <div className="border-r border-black px-3 py-2">
            <span className="font-semibold">Issue Date:</span> {formatDate(invoice.invoiceDate)}
          </div>
          <div className="border-r border-black px-3 py-2">
            <span className="font-semibold">{isDirectInvoice ? 'Reference:' : 'Booking ID:'}</span> {bookingOrReference}
          </div>
          <div className="border-r border-black px-3 py-2">
            <span className="font-semibold">Vehicle:</span> {vehicle}
          </div>
          <div className="px-3 py-2">
            <span className="font-semibold">Service City:</span> {serviceCity}
          </div>
        </section>

        <table className="w-full table-fixed border-collapse border-y border-slate-300 bg-white leading-[1.5]">
          <thead className="bg-slate-100">
            <tr className="font-bold uppercase text-slate-950">
              <th className="w-[20%] whitespace-nowrap px-3 py-2 text-left">Date of Use</th>
              <th className="w-[32%] px-3 py-2 text-left">Description</th>
              <th className="w-[10%] px-3 py-2.5 text-right">Qty</th>
              <th className="w-[12%] px-4 py-2.5 text-left">Unit</th>
              <th className="w-[12%] border-l border-slate-300 px-4 py-2.5 text-right">Rate</th>
              <th className="w-[14%] border-l border-slate-300 px-2 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, index) => (
              <tr key={item.id} className={`align-top border-t border-slate-200 ${index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="px-3 py-2 font-medium"><ServicePeriod item={item} /></td>
                <td className="px-3 py-2.5 font-medium text-slate-950">{item.description}</td>
                <td className="px-3 py-2.5 text-right font-medium">{item.qty}</td>
                <td className="px-4 py-2.5 font-medium">{item.unit}</td>
                <td className="border-l border-slate-200 px-4 py-2.5 text-right font-medium">{cleanMoney(item.rate)}</td>
                <td className="border-l border-slate-200 px-2 py-2.5 text-right font-bold">{cleanMoney(item.amount)}</td>
              </tr>
            ))}
            <tr className="border-y-2 border-black bg-slate-100 font-extrabold">
              <td colSpan={5} className="px-3 py-1.5">TOTAL</td>
              <td className="whitespace-nowrap border-l border-slate-300 px-2 py-1.5 text-right text-[13px]">{amount(totals.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <section className="grid grid-cols-[62%_38%] border-b border-slate-300 bg-white leading-[1.5]">
          <div className="px-4 pb-4 pt-3">
            <p className="font-bold">Bank Details</p>
            <div className="mt-2 font-medium">
              {[
                ['Name:', bank.accountName],
                ['Account No.:', bank.accountNumber],
                ['Bank Name:', bank.bankName],
                ['IFSC Code:', bank.ifscCode],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-2 py-0.5">
                  <div className="w-[40%] min-w-20 font-semibold">{label}</div>
                  <div>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-l border-slate-300">
            <SummaryLine label="Subtotal" value={totals.subtotal} />
            <SummaryLine label="Taxable Amount" value={totals.taxableAmount} />
            {totals.cgst > 0 && <SummaryLine label="CGST 2.5%" value={totals.cgst} />}
            {totals.sgst > 0 && <SummaryLine label="SGST 2.5%" value={totals.sgst} />}
            {totals.igst > 0 && <SummaryLine label="IGST 5%" value={totals.igst} />}
            <SummaryLine label="Total GST" value={totals.totalTax} />
            <SummaryLine label="Net Payable" value={totals.netPayable} strong />

            <div className="px-4 pb-4 pt-8 text-right">
              <InvoiceSignature src={signatureUrl} className="ml-auto h-[100px] w-[150px] object-contain" />
              <p className="mt-1 font-bold leading-[1.5]">AUTHORISED SIGNATORY FOR</p>
              <p className="font-medium leading-[1.5]">COMFORT CARS TAXI SERVICE</p>
            </div>
          </div>
        </section>
      </div>
    </article>
  )
}

export default InvoicePreviewTemplate
