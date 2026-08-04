import { useEffect, useMemo, useState } from "react";
import {
  createAccountTransaction,
  getAccountsErrorMessage,
  listAccountTransactions,
} from "../../services/accounts";
import { listBookings } from "../../services/bookings";
import { listDrivers } from "../../services/drivers";
import { listVehicles } from "../../services/vehicles";
import Pagination from "../../components/Pagination";
import {
  FilterBar,
  Section,
  SummaryCard,
  TableShell,
  fieldClass,
  money,
} from "./accountUtils";

const types = [
  "EXPENSE",
  "ADJUSTMENT",
  "FUND_RETURN",
  "DRIVER_ADVANCE",
  "DRIVER_RECOVERY",
  "PARTNER_WITHDRAWAL",
  "OWNER_WITHDRAWAL",
  "EMPLOYEE_ADVANCE",
];
const categories = [
  "FUEL",
  "VEHICLE_MAINTENANCE",
  "DRIVER_PAYMENT",
  "OFFICE_EXPENSE",
  "EMPLOYEE_ADVANCE",
  "PARTNER_OWNER_WITHDRAWAL",
  "RECOVERABLE_TRIP_CHARGE",
  "OTHER",
];
const initial = {
  ledgerId: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  transactionType: "EXPENSE",
  direction: "DEBIT",
  category: "OTHER",
  paymentMode: "CASH",
  amount: "",
  description: "",
  referenceNumber: "",
  remarks: "",
  vehicleId: "",
  bookingId: "",
  driverId: "",
};
const label = (value) =>
  String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function TransactionsPage() {
  const [data, setData] = useState({
    transactions: [],
    ledgers: [],
    summary: {},
  });
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 25 });
  const [options, setOptions] = useState({
    vehicles: [],
    bookings: [],
    drivers: [],
  });
  const load = async () => {
    try {
      const result = await listAccountTransactions({
        page: pagination.page,
        limit: pagination.limit,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setData(result);
      setPagination(result.pagination);
      setError("");
    } catch (requestError) {
      setError(getAccountsErrorMessage(requestError));
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [pagination.page, pagination.limit, search]);
  useEffect(() => {
    Promise.all([
      listVehicles({ limit: 100 }),
      listBookings({ limit: 100 }),
      listDrivers({ limit: 100 }),
    ])
      .then(([vehicles, bookings, drivers]) =>
        setOptions({
          vehicles: vehicles.items || [],
          bookings: bookings.items || [],
          drivers: drivers.items || [],
        }),
      )
      .catch(() => {});
  }, []);
  const rows = useMemo(
    () =>
      data.transactions.filter((row) =>
        [
          row.description,
          row.referenceNumber,
          row.transactionType,
          row.category,
          row.ledger?.manager?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.transactions, search],
  );
  async function submit(event) {
    event.preventDefault();
    try {
      await createAccountTransaction({
        ...form,
        amount: Number(form.amount),
        category: form.transactionType === "EXPENSE" ? form.category : null,
        direction:
          form.transactionType === "ADJUSTMENT" ? form.direction : undefined,
        vehicleId: form.vehicleId || null,
        bookingId: form.bookingId || null,
        driverId: form.driverId || null,
      });
      setForm(initial);
      setNotice("Transaction posted to the manager ledger.");
      await load();
    } catch (requestError) {
      setError(getAccountsErrorMessage(requestError));
    }
  }
  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Transactions"
          value={data.transactions.length}
          prefix=""
        />
        <SummaryCard
          label="Credits"
          value={data.summary.credits || 0}
          tone="success"
        />
        <SummaryCard
          label="Debits"
          value={data.summary.debits || 0}
          tone="warning"
        />
        <SummaryCard
          label="Net Movement"
          value={(data.summary.credits || 0) - (data.summary.debits || 0)}
        />
      </div>
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Post Account Transaction</h3>
            <p className="text-sm text-slate-500">
              Posts atomically to the selected manager ledger.
            </p>
          </div>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
            Save Transaction
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label>
            Manager Ledger
            <select
              required
              className={fieldClass}
              value={form.ledgerId}
              onChange={(e) => setForm({ ...form, ledgerId: e.target.value })}
            >
              <option value="">Select ledger</option>
              {data.ledgers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.manager.name} · {row.location.name} · ₹
                  {money(row.currentBalance)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              required
              type="date"
              className={fieldClass}
              value={form.transactionDate}
              onChange={(e) =>
                setForm({ ...form, transactionDate: e.target.value })
              }
            />
          </label>
          <label>
            Type
            <select
              className={fieldClass}
              value={form.transactionType}
              onChange={(e) =>
                setForm({ ...form, transactionType: e.target.value })
              }
            >
              {types.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          {form.transactionType === "ADJUSTMENT" && (
            <label>
              Direction
              <select
                className={fieldClass}
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value })
                }
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </label>
          )}
          {form.transactionType === "EXPENSE" && (
            <label>
              Category
              <select
                className={fieldClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.transactionType === "EXPENSE" &&
            ["FUEL", "VEHICLE_MAINTENANCE"].includes(form.category) && (
              <label>
                Vehicle
                <select
                  required
                  className={fieldClass}
                  value={form.vehicleId}
                  onChange={(e) =>
                    setForm({ ...form, vehicleId: e.target.value })
                  }
                >
                  <option value="">Select vehicle</option>
                  {options.vehicles.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.registrationNumber || row.plate}
                    </option>
                  ))}
                </select>
              </label>
            )}
          {form.transactionType === "EXPENSE" &&
            form.category === "DRIVER_PAYMENT" && (
              <label>
                Driver
                <select
                  required
                  className={fieldClass}
                  value={form.driverId}
                  onChange={(e) =>
                    setForm({ ...form, driverId: e.target.value })
                  }
                >
                  <option value="">Select driver</option>
                  {options.drivers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          {form.transactionType === "EXPENSE" &&
            form.category === "RECOVERABLE_TRIP_CHARGE" && (
              <label>
                Booking
                <select
                  required
                  className={fieldClass}
                  value={form.bookingId}
                  onChange={(e) =>
                    setForm({ ...form, bookingId: e.target.value })
                  }
                >
                  <option value="">Select booking</option>
                  {options.bookings.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.bookingNumber || row.bookingId || row.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
          <label>
            Payment Mode
            <select
              className={fieldClass}
              value={form.paymentMode}
              onChange={(e) =>
                setForm({ ...form, paymentMode: e.target.value })
              }
            >
              {["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE"].map(
                (value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Amount
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              className={fieldClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label>
            Reference
            <input
              required
              minLength="3"
              className={fieldClass}
              value={form.referenceNumber}
              onChange={(e) =>
                setForm({ ...form, referenceNumber: e.target.value })
              }
            />
          </label>
          <label className="md:col-span-2">
            Purpose / Description
            <input
              required
              minLength="3"
              className={fieldClass}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="md:col-span-2">
            Remarks
            <input
              className={fieldClass}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </label>
        </div>
      </form>
      <Section
        title="Transaction Register"
        actions={
          <FilterBar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          />
        }
      >
        <TableShell
          columns={[
            "Date",
            "Manager / Location",
            "Type",
            "Category",
            "Description",
            "Reference",
            "Credit",
            "Debit",
          ]}
          minWidth="1050px"
          empty={rows.length === 0}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.transactionDate}</td>
              <td className="px-4 py-3 font-semibold">
                {row.ledger.manager.name}
                <span className="block text-xs font-normal text-slate-500">
                  {row.ledger.location.name}
                </span>
              </td>
              <td className="px-4 py-3">{label(row.transactionType)}</td>
              <td className="px-4 py-3">{label(row.category) || "-"}</td>
              <td className="px-4 py-3">{row.description}</td>
              <td className="px-4 py-3">{row.referenceNumber}</td>
              <td className="px-4 py-3 text-emerald-700">
                ₹ {money(row.direction === "CREDIT" ? row.amount : 0)}
              </td>
              <td className="px-4 py-3 text-rose-700">
                ₹ {money(row.direction === "DEBIT" ? row.amount : 0)}
              </td>
            </tr>
          ))}
        </TableShell>
        <Pagination
          pagination={pagination}
          onPageChange={(page) =>
            setPagination((current) => ({ ...current, page }))
          }
          onLimitChange={(limit) =>
            setPagination((current) => ({ ...current, page: 1, limit }))
          }
        />
      </Section>
    </div>
  );
}
