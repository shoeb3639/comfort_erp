import { calculateInvoiceAmounts } from './invoice.service'

const invoice = {
  customerId: '00000000-0000-4000-8000-000000000001',
  invoiceDate: new Date('2026-07-30'),
  gstType: 'NO_GST' as const,
  billingName: 'Test Customer',
  billingAddress: 'Test Address',
  items: [
    {
      dateType: 'single',
      description: 'Trip',
      quantity: 2,
      unit: 'Trip',
      rate: 1000,
      amount: 2000,
    },
  ],
}

describe('invoice calculations', () => {
  it('calculates CGST and SGST from invoice items', () => {
    expect(
      calculateInvoiceAmounts({ ...invoice, gstType: 'CGST_SGST' }),
    ).toMatchObject({
      subtotal: 2000,
      taxableAmount: 2000,
      cgstAmount: 50,
      sgstAmount: 50,
      igstAmount: 0,
      totalGst: 100,
      netPayable: 2100,
    })
  })

  it('calculates IGST and rejects a mismatched manual amount', () => {
    expect(
      calculateInvoiceAmounts({ ...invoice, gstType: 'IGST' }),
    ).toMatchObject({ igstAmount: 100, netPayable: 2100 })
    expect(() =>
      calculateInvoiceAmounts({
        ...invoice,
        items: [{ ...invoice.items[0]!, amount: 1900 }],
      }),
    ).toThrow('amount must equal quantity × rate')
  })
})
