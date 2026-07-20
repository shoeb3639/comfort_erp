import { vehicles } from '../../services/api'

function VehiclesPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{vehicle.type}</p>
              <p className="text-sm text-slate-500">Plate {vehicle.plate}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-600">
              {vehicle.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VehiclesPage
