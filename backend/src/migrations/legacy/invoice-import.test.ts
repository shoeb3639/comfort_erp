import { INVOICE_HEADERS, prepareInvoiceMigration } from './invoice-import'
import { toCsv } from './csv'
import { PRAYAGRAJ_TENANT_ID } from './vendor-import'

function invoice(overrides: Record<string, string> = {}) {
  const detail = {
    bookingId: 'CMF25-80503',
    cus_name: '',
    company_name: 'Example Limited',
    gstin_no: '33AAACD2238A1ZI',
    address: 'Example address',
    trip_details: [
      {
        use_date: '2025-08-05',
        vehicle: 'Toyota Innova',
        travelling: 'Prayagraj local',
        km: '100',
        rate: '10',
        total_amt: '1000',
      },
    ],
    sub_total: '1000',
    tollTax: '100',
    parking: '0',
    da: '0',
    serviceCharge: '0',
    cgst: '25',
    sgst: '25',
    igst: '0',
    grand_total: '1150',
  }
  const values: Record<string, string> = {
    id: '1',
    invoice_no: '24579',
    issue_date: '09-08-2025',
    issuedBy: 'Syed Shoeb',
    booking_id: 'CMF25-80503',
    json_data: JSON.stringify({ invoice_details: detail }),
    companyName: 'Example Limited',
    companyGST: '33AAACD2238A1ZI',
    invoiceType: 'local',
    customer: '',
    total_amount: '999',
    isGSTCharge: '1',
    gstAmount: '50',
    serviceCharge: '0',
    vehicle: '',
    ...overrides,
  }
  return INVOICE_HEADERS.map((header) => values[header])
}

const mappings = {
  bookings: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      bookingNumber: 'CMF25-80503',
      customerId: '22222222-2222-4222-8222-222222222222',
    },
  ],
  customers: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Example Limited',
      billingName: 'Example Limited',
      gstin: '33AAACD2238A1ZI',
    },
  ],
}

describe('legacy invoice migration preparation', () => {
  it('uses the booking customer and JSON grand total', () => {
    const prepared = prepareInvoiceMigration(
      toCsv([INVOICE_HEADERS, invoice()]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(prepared.accepted[0]).toMatchObject({
      bookingId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      status: 'GENERATED',
      gstType: 'CGST_SGST',
      taxableAmount: 1100,
      totalGst: 50,
      netPayable: 1150,
    })
    expect(prepared.accepted[0]?.legacy.sourceTotalAmount).toBe(999)
  })

  it('retains the earlier duplicate number and removes the later row', () => {
    const prepared = prepareInvoiceMigration(
      toCsv([
        INVOICE_HEADERS,
        invoice(),
        invoice({
          id: '2',
          issue_date: '02-10-2025',
          booking_id: '',
        }),
      ]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(prepared.accepted).toHaveLength(1)
    expect(prepared.accepted[0]?.legacy.id).toBe('1')
    expect(prepared.rejected).toEqual([
      expect.objectContaining({
        legacyId: '2',
        reason: 'DUPLICATE_INVOICE_NUMBER_REMOVED',
      }),
    ])
  })

  it('imports additional booking invoices as direct invoices', () => {
    const prepared = prepareInvoiceMigration(
      toCsv([
        INVOICE_HEADERS,
        invoice({ invoice_no: '24001' }),
        invoice({ id: '2', invoice_no: '24002', issue_date: '10-08-2025' }),
      ]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(prepared.accepted.map((row) => row.bookingId)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      null,
    ])
    expect(prepared.accepted[1]).toMatchObject({
      referenceNumber: 'CMF25-80503',
      legacy: {
        bookingResolution: 'ADDITIONAL_INVOICE_IMPORTED_DIRECT',
      },
    })
  })
})
