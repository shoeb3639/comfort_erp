import { expenses } from '../../services/api'

function ExpensesPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{expense.category}</p>
              <p className="text-sm text-slate-500">
                {expense.vendor} • {expense.date}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{expense.amount}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {expense.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExpensesPage
