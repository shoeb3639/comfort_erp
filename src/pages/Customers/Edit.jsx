import { Link, useParams } from 'react-router-dom'
import { getMockData } from '../../services/api'
import CustomerForm from './components/CustomerForm'

function CustomerEditPage() {
  const { customerId } = useParams()
  const customers = getMockData('customers')
  const customer = customers.find((item) => item.id === customerId)

  if (!customer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Customer not found.{' '}
        <Link className="font-semibold text-brand-600" to="/customers">
          Back to customers
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <CustomerForm customer={customer} mode="edit" />
    </div>
  )
}

export default CustomerEditPage
