import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Car,
  ClipboardList,
  Edit,
  Eye,
  FileCheck,
  MessageSquare,
  MoreVertical,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { deleteMockRecord, getMockData, saveMockData } from '../../services/api'
import ActionNotice from '../../components/ActionNotice'

const pageSizeOptions = [10, 20, 40, 50]

const listViewOptions = [
  { value: 'active', label: 'Current / Ongoing' },
  { value: 'closed', label: 'Closed Bookings' },
]

const statusStyles = {
  Confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'In Transit': 'bg-brand-50 text-brand-700 ring-brand-600/20',
  Completed: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  Cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Closed: 'bg-slate-900 text-white ring-slate-900',
}

function toNumber(value) {
  return Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0
}

function canCloseBooking(booking) {
  return (
    ['Confirmed', 'Assigned', 'Completed'].includes(booking.status) ||
    (booking.assignment_status === 'Assigned' && booking.status !== 'Closed' && booking.status !== 'Cancelled')
  )
}

function hasBillAmount(booking, invoices) {
  const invoice = invoices.find((item) => item.booking === booking.id || item.bookingId === booking.id)
  return Boolean(
    invoice ||
      toNumber(booking.closeDetails?.totalBillAmount) > 0 ||
      toNumber(booking.fixedAmount) > 0 ||
      toNumber(booking.amount) > 0,
  )
}

function isBookingClosed(booking) {
  return booking.status === 'Closed' || Boolean(booking.closeDetails)
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        statusStyles[status] || 'bg-slate-100 text-slate-700 ring-slate-500/20'
      }`}
    >
      {status}
    </span>
  )
}

function getBookingCategory(booking) {
  if (booking.booking_type === 'package') return 'Package'
  if (booking.customer_type === 'Corporate') return 'Corporate'
  if (booking.customer_type === 'Retail') return 'Retail'
  if (booking.customer_type === 'Travel Agent') return 'Travel Agent'
  return booking.booking_type ? booking.booking_type.replace('_', ' ') : 'Standard'
}

function CategoryBadge({ category }) {
  const tone =
    category === 'Corporate'
      ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
      : category === 'Retail'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
        : category === 'Package'
          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
          : 'bg-slate-100 text-slate-700 ring-slate-500/20'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>{category}</span>
}

function formatDate(value, options = {}) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(options.year ? { year: '2-digit' } : {}),
  })
}

function RouteText({ locations }) {
  const routeLocations = locations.filter(Boolean)

  if (!routeLocations.length) return <span>-</span>
  const [fromLocation, ...toLocations] = routeLocations

  return (
    <span className="block">
      <span className="block">{fromLocation}</span>
      {toLocations.length > 0 && (
        <span className="mt-1 inline-flex flex-wrap items-center gap-1.5">
          {toLocations.map((location, index) => (
            <span key={`${location}-${index}`} className="inline-flex items-center gap-1.5">
              <ArrowRight size={14} strokeWidth={2.4} className="text-slate-400" />
              <span>{location}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

function AssignmentModal({ booking, drivers, vehicles, vendors, onClose, onSave }) {
  const initialVehicle = vehicles.find((vehicle) => vehicle.plate === booking.vehicleRegistrationNo)
  const initialDriver = drivers.find((driver) => driver.name === booking.driver)
  const initialVendor = vendors.find((vendor) => vendor.name === booking.vendor || vendor.id === booking.vendorId)
  const [formValues, setFormValues] = useState({
    assignmentType: booking.assignmentType || booking.assignment_type || 'own_vehicle',
    vendorId: initialVendor?.id || booking.vendorId || '',
    vendor: booking.vendor && booking.vendor !== 'Unassigned' ? booking.vendor : '',
    vehicleId: initialVehicle?.id || '',
    vehicleType: booking.vehicleType && booking.vehicleType !== 'Unassigned' ? booking.vehicleType : '',
    vehicleRegistrationNo: booking.vehicleRegistrationNo || '',
    driverId: initialDriver?.id || '',
    driver: booking.driver && booking.driver !== 'Unassigned' ? booking.driver : '',
    driverNumber: booking.driverNumber || initialDriver?.phone || '',
    vendorRateType: booking.vendorRateType || 'Fixed Amount',
    vendorRate: booking.vendorRate || '',
    vendorPayableAmount: booking.vendorPayableAmount || '',
    vendorNotes: booking.vendorNotes || '',
  })
  const isVendorVehicle = formValues.assignmentType === 'vendor_vehicle'
  const allowedVendors = vendors.filter((vendor) =>
    isVendorVehicle ? vendor.recordType !== 'own_company' : vendor.recordType === 'own_company',
  )
  const visibleVehicles = vehicles.filter((vehicle) => {
    const matchesVendor = formValues.vendorId ? vehicle.vendorId === formValues.vendorId : true
    const ownershipType = vehicle.ownershipType || (vendors.find((vendor) => vendor.id === vehicle.vendorId)?.recordType === 'own_company' ? 'own' : 'vendor')
    return matchesVendor && (isVendorVehicle ? ownershipType === 'vendor' : ownershipType === 'own')
  })
  const visibleDrivers = drivers.filter((driver) => {
    const matchesVendor = formValues.vendorId ? driver.vendorId === formValues.vendorId : true
    const ownershipType = driver.ownershipType || (vendors.find((vendor) => vendor.id === driver.vendorId)?.recordType === 'own_company' ? 'own' : 'vendor')
    return matchesVendor && (isVendorVehicle ? ownershipType === 'vendor' : ownershipType === 'own')
  })

  function updateField(name, value) {
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }))
  }

  function handleAssignmentTypeChange(assignmentType) {
    setFormValues((currentValues) => ({
      ...currentValues,
      assignmentType,
      vendorId: '',
      vendor: '',
      vehicleId: '',
      vehicleType: '',
      vehicleRegistrationNo: '',
      driverId: '',
      driver: '',
      driverNumber: '',
      vendorRateType: assignmentType === 'vendor_vehicle' ? currentValues.vendorRateType : 'Fixed Amount',
      vendorRate: assignmentType === 'vendor_vehicle' ? currentValues.vendorRate : '',
      vendorPayableAmount: assignmentType === 'vendor_vehicle' ? currentValues.vendorPayableAmount : '',
      vendorNotes: assignmentType === 'vendor_vehicle' ? currentValues.vendorNotes : '',
    }))
  }

  function handleVendorChange(vendorId) {
    const vendor = vendors.find((item) => item.id === vendorId)
    setFormValues((currentValues) => ({
      ...currentValues,
      vendorId,
      vendor: vendor?.name || '',
      vehicleId: '',
      vehicleType: '',
      vehicleRegistrationNo: '',
      driverId: '',
      driver: '',
      driverNumber: '',
    }))
  }

  function handleVehicleChange(vehicleId) {
    const vehicle = vehicles.find((item) => item.id === vehicleId)
    setFormValues((currentValues) => ({
      ...currentValues,
      vehicleId,
      vehicleType: vehicle?.make || vehicle?.type || '',
      vehicleRegistrationNo: vehicle?.plate || '',
    }))
  }

  function handleDriverChange(driverId) {
    const driver = drivers.find((item) => item.id === driverId)
    setFormValues((currentValues) => ({
      ...currentValues,
      driverId,
      driver: driver?.name || '',
      driverNumber: driver?.phone || '',
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (
      !formValues.vendor ||
      !formValues.vehicleType ||
      !formValues.vehicleRegistrationNo ||
      !formValues.driver ||
      !formValues.driverNumber ||
      (isVendorVehicle && !formValues.vendorPayableAmount)
    ) {
      return
    }

    onSave({
      assignmentType: formValues.assignmentType,
      assignment_type: formValues.assignmentType,
      vendorId: formValues.vendorId,
      vendor: formValues.vendor,
      vehicleType: formValues.vehicleType,
      vehicleRegistrationNo: formValues.vehicleRegistrationNo,
      driver: formValues.driver,
      driverNumber: formValues.driverNumber,
      vendorRateType: isVendorVehicle ? formValues.vendorRateType : '',
      vendorRate: isVendorVehicle ? formValues.vendorRate : '',
      vendorPayableAmount: isVendorVehicle ? formValues.vendorPayableAmount : '',
      vendorNotes: isVendorVehicle ? formValues.vendorNotes : '',
      assignment_status: 'Assigned',
      status: booking.status === 'Pending' ? 'Confirmed' : booking.status,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Assign Vehicle & Driver</h3>
            <p className="text-sm text-slate-500">
              {booking.id} • {booking.customer}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close assignment modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Assignment Source</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.assignmentType}
                onChange={(event) => handleAssignmentTypeChange(event.target.value)}
                required
              >
                <option value="own_vehicle">Own Vehicle</option>
                <option value="vendor_vehicle">Vendor Vehicle</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Vendor vehicle profit will be calculated separately from own vehicle profit.
              </p>
            </label>

            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Vendor</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vendorId}
                onChange={(event) => handleVendorChange(event.target.value)}
                required
              >
                <option value="">Select vendor</option>
                {allowedVendors
                  .filter((vendor) => vendor.status === 'Active')
                  .map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} • {vendor.city} • {isVendorVehicle ? 'Vendor' : 'Own'}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Vehicle</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleId}
                onChange={(event) => handleVehicleChange(event.target.value)}
                required
              >
                <option value="">Select vehicle</option>
                {visibleVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make || vehicle.type} • {vehicle.plate} • {vehicle.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Vehicle Type</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleType}
                onChange={(event) => updateField('vehicleType', event.target.value)}
                required
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Vehicle No.</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.vehicleRegistrationNo}
                onChange={(event) => updateField('vehicleRegistrationNo', event.target.value)}
                required
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Driver</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.driverId}
                onChange={(event) => handleDriverChange(event.target.value)}
                required
              >
                <option value="">Select driver</option>
                {visibleDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} • {driver.phone} • {driver.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Driver Number</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={formValues.driverNumber}
                onChange={(event) => updateField('driverNumber', event.target.value)}
                required
              />
            </label>

            {isVendorVehicle && (
              <>
                <label>
                  <span className="text-sm font-medium text-slate-700">Vendor Rate Type</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={formValues.vendorRateType}
                    onChange={(event) => updateField('vendorRateType', event.target.value)}
                    required
                  >
                    <option>Fixed Amount</option>
                    <option>Per KM</option>
                    <option>Per Day</option>
                    <option>Package</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">Vendor Rate</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    type="number"
                    step="0.01"
                    value={formValues.vendorRate}
                    onChange={(event) => updateField('vendorRate', event.target.value)}
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">Vendor Payable Amount</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    type="number"
                    step="0.01"
                    value={formValues.vendorPayableAmount}
                    onChange={(event) => updateField('vendorPayableAmount', event.target.value)}
                    required
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">Vendor Notes</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={formValues.vendorNotes}
                    onChange={(event) => updateField('vendorNotes', event.target.value)}
                    placeholder="Vendor deal remarks"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Save Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BookingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState(() => getMockData('bookings'))
  const [drivers] = useState(() => getMockData('drivers'))
  const [vehicles] = useState(() => getMockData('vehicles'))
  const [vendors] = useState(() => getMockData('vendors'))
  const [invoices] = useState(() => getMockData('invoices'))
  const [customers] = useState(() => getMockData('customers'))
  const [travellers] = useState(() => getMockData('travellers'))
  const [search, setSearch] = useState('')
  const [listView, setListView] = useState('active')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [openActionId, setOpenActionId] = useState('')
  const [assignmentBooking, setAssignmentBooking] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice || '')

  const statusOptions = useMemo(() => {
    const visibleBookings = bookings.filter((booking) =>
      listView === 'closed' ? isBookingClosed(booking) : !isBookingClosed(booking),
    )
    return ['All', ...Array.from(new Set(visibleBookings.map((booking) => booking.status)))]
  }, [bookings, listView])

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  )

  const travellerById = useMemo(
    () => new Map(travellers.map((traveller) => [traveller.id, traveller])),
    [travellers],
  )

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase()

    return bookings.filter((booking) => {
      const customer = customerById.get(booking.billing_customer_id)
      const traveller = travellerById.get(booking.traveller_id)
      const matchesListView = listView === 'closed' ? isBookingClosed(booking) : !isBookingClosed(booking)
      const matchesStatus = statusFilter === 'All' || booking.status === statusFilter
      const searchableText = [
        booking.id,
        booking.customer,
        customer?.displayName,
        customer?.billingName,
        customer?.phone,
        traveller?.name,
        traveller?.phone,
        booking.customer_type,
        booking.booking_type,
        booking.duty_package,
        booking.serviceCity,
        booking.pickupLocation,
        booking.dropLocation,
        booking.routeStops,
        booking.vehicleType,
        booking.vendor,
        booking.driver,
      ]
        .join(' ')
        .toLowerCase()

      return matchesListView && matchesStatus && (!query || searchableText.includes(query))
    })
  }, [bookings, customerById, listView, search, statusFilter, travellerById])

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedBookings = filteredBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function handleDeleteBooking(id) {
    setBookings(deleteMockRecord('bookings', id))
    setOpenActionId('')
    setNotice(`Booking ${id} deleted.`)
  }

  function handleAssignBooking(id, assignment) {
    setBookings((currentBookings) => {
      const nextBookings = currentBookings.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              ...assignment,
            }
          : booking,
      )
      saveMockData('bookings', nextBookings)
      return nextBookings
    })
    setOpenActionId('')
    setAssignmentBooking(null)
    setNotice(`Booking ${id} assigned successfully.`)
  }

  function handleGenerateDutySlip(booking) {
    console.log('Generate duty slip', booking)
    setOpenActionId('')
    setNotice(`Duty slip generated for ${booking.id}.`)
  }

  function handleSendMessage(booking) {
    console.log('Send booking message', booking)
    setOpenActionId('')
    setNotice(`Message prepared for ${booking.id}.`)
  }

  function handleFilterChange(value) {
    setStatusFilter(value)
    setPage(1)
  }

  function handleListViewChange(value) {
    setListView(value)
    setStatusFilter('All')
    setPage(1)
  }

  function handlePageSizeChange(value) {
    setPageSize(Number(value))
    setPage(1)
  }

  function handleSearchChange(value) {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <ActionNotice
        message={notice}
        onDismiss={() => {
          setNotice('')
          navigate('.', { replace: true, state: null })
        }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-semibold text-slate-900">Booking List</h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_190px_220px]">
            <label className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <Search className="mr-2 text-slate-400" size={18} strokeWidth={2.2} />
              <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Search customer, route, vendor, driver"
              />
            </label>

            <select
              value={listView}
              onChange={(event) => handleListViewChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {listViewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => handleFilterChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-[120px] px-3 py-3 text-left font-semibold text-slate-700">Booking</th>
                <th className="w-[180px] px-3 py-3 text-left font-semibold text-slate-700">Customer</th>
                <th className="w-[125px] px-3 py-3 text-left font-semibold text-slate-700">Trip Dates</th>
                <th className="w-[105px] px-3 py-3 text-left font-semibold text-slate-700">City</th>
                <th className="w-[180px] px-3 py-3 text-left font-semibold text-slate-700">Route</th>
                <th className="w-[180px] px-3 py-3 text-left font-semibold text-slate-700">Assignment</th>
                <th className="w-[100px] px-3 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="w-[70px] px-3 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedBookings.map((booking) => {
                const customer = customerById.get(booking.billing_customer_id)
                const traveller = travellerById.get(booking.traveller_id)
                const customerName = traveller?.name || booking.travellerName || customer?.displayName || booking.customer || '-'
                const companyName =
                  booking.customer_type === 'Retail'
                    ? customer?.billingName || customerName
                    : customer?.billingName || customer?.name || booking.customer || '-'
                const mobileNumber = traveller?.phone || customer?.phone || booking.customerPhone || '-'
                const vehicleText = booking.vehicleRegistrationNo || booking.requestedVehicleType || 'Vehicle pending'
                const routeStops = booking.routeStops
                  ? booking.routeStops.split('>').map((stop) => stop.trim()).filter(Boolean)
                  : []
                const routeLocations = [booking.pickupLocation || '', ...(routeStops.length ? routeStops : [booking.dropLocation || 'Drop not fixed'])]
                const tripStartValue = booking.startDate || booking.pickupDate
                const tripEndValue = booking.endDate || booking.startDate || booking.pickupDate
                const tripStart = formatDate(tripStartValue, { year: true })
                const tripEnd = formatDate(tripEndValue)
                const isSameTripDate =
                  tripStartValue &&
                  tripEndValue &&
                  new Date(tripStartValue).toDateString() === new Date(tripEndValue).toDateString()
                const tripDateText = isSameTripDate ? tripStart : `${tripStart} to ${tripEnd}`
                const pickupTime = booking.pickupTime || booking.reportingTime || ''
                const assignmentDetail = `${vehicleText} - ${booking.driver || 'Driver pending'}`
                const isVendorVehicle = (booking.assignmentType || booking.assignment_type) === 'vendor_vehicle'

                return (
                <tr key={booking.id} className="align-top hover:bg-slate-50">
                  <td className="w-[120px] px-3 py-3">
                    <p className="font-semibold text-slate-950">{booking.id}</p>
                    <div className="mt-1">
                      <CategoryBadge category={getBookingCategory(booking)} />
                    </div>
                  </td>
                  <td className="w-[180px] max-w-[180px] px-3 py-3">
                    <p className="font-semibold text-slate-950">{customerName}</p>
                    <p className="mt-1 font-medium text-slate-700">{mobileNumber}</p>
                    <p className="mt-1 truncate text-xs text-slate-500" title={companyName}>{companyName}</p>
                  </td>
                  <td className="w-[125px] px-3 py-3">
                    <p className="font-semibold text-slate-900">{tripDateText}</p>
                    {pickupTime && <p className="mt-1 text-xs font-semibold text-slate-500">{pickupTime}</p>}
                  </td>
                  <td className="w-[105px] max-w-[105px] px-3 py-3">
                    <p className="truncate font-semibold text-slate-900" title={booking.serviceCity || ''}>{booking.serviceCity || '-'}</p>
                  </td>
                  <td className="w-[180px] px-3 py-3">
                    <p className="break-words font-semibold text-slate-900">
                      <RouteText locations={routeLocations} />
                    </p>
                  </td>
                  <td className="w-[180px] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold text-slate-900">{booking.vendor || 'Unassigned'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isVendorVehicle ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {isVendorVehicle ? 'Vendor' : 'Own'}
                      </span>
                    </div>
                    <p className="mt-1 break-words font-semibold text-slate-900">{assignmentDetail}</p>
                  </td>
                  <td className="w-[100px] px-3 py-3">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="w-[70px] px-3 py-3 text-right">
                    <div className="relative inline-flex justify-end">
                      <button
                        type="button"
                        aria-expanded={openActionId === booking.id}
                        aria-label={`Open actions for ${booking.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={() => setOpenActionId((currentId) => (currentId === booking.id ? '' : booking.id))}
                      >
                        <MoreVertical size={17} />
                      </button>

                      {openActionId === booking.id && (
                        <div className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                          <Link
                            to={`/bookings/${booking.id}`}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => setOpenActionId('')}
                          >
                            <Eye size={16} />
                            View
                          </Link>
                          <Link
                            to={`/bookings/${booking.id}/edit`}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => setOpenActionId('')}
                          >
                            <Edit size={16} />
                            Edit
                          </Link>
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setAssignmentBooking(booking)
                              setOpenActionId('')
                            }}
                          >
                            <Car size={16} />
                            Assign Vehicle & Driver
                          </button>
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => handleGenerateDutySlip(booking)}
                          >
                            <ClipboardList size={16} />
                            Generate Duty Slip
                          </button>
                          {canCloseBooking(booking) && (
                            <Link
                              to={`/bookings/${booking.id}/close`}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId('')}
                            >
                              <FileCheck size={16} />
                              Close Booking
                            </Link>
                          )}
                          {hasBillAmount(booking, invoices) && (
                            <Link
                              to={`/bookings/${booking.id}/collections`}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId('')}
                            >
                              <WalletCards size={16} />
                              Collection
                            </Link>
                          )}
                          {isBookingClosed(booking) && (
                            <Link
                              to={`/bookings/${booking.id}/profit`}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId('')}
                            >
                              <BarChart3 size={16} />
                              Profit
                            </Link>
                          )}
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => handleSendMessage(booking)}
                          >
                            <MessageSquare size={16} />
                            Send Message
                          </button>
                          <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteBooking(booking.id)}
                          >
                            <Trash2 size={16} />
                            Delete Booking
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>

          {paginatedBookings.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">No bookings found.</div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {paginatedBookings.length} of {filteredBookings.length} bookings
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Records per page</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="px-2 font-medium text-slate-900">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {assignmentBooking && (
        <AssignmentModal
          booking={assignmentBooking}
          drivers={drivers}
          vehicles={vehicles}
          vendors={vendors}
          onClose={() => setAssignmentBooking(null)}
          onSave={(assignment) => handleAssignBooking(assignmentBooking.id, assignment)}
        />
      )}
    </div>
  )
}

export default BookingsPage
