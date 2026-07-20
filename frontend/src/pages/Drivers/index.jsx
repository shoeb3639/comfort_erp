import { drivers } from '../../services/api'

function DriversPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{driver.name}</p>
              <p className="text-sm text-slate-500">License {driver.license}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {driver.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DriversPage
