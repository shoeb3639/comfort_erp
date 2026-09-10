import "./mobile-cards.css";
import VehiclePerformanceTable from "./VehiclePerformanceTable";
import OutstandingCards from "./OutstandingCards";
import FilteredSummaryCard, { summaryMetrics } from "./FilteredSummaryCard";
import { useEffect, useState } from "react";
import {
  getAccountsAudit,
  listAccountTransactions,
  listCashDeposits,
  listManagerLedgers,
} from "../../services/accounts";
import { listBookings } from "../../services/bookings";
import { getCustomers } from "../../services/customers";
import { listDrivers } from "../../services/drivers";
import { listInvoices } from "../../services/invoices";
import { getCompanyProfile } from "../../services/tenantSetup";
import {
  AlertList,
  Badge,
  BarChart,
  CashFlowWidget,
  DataTableWidget,
  DonutChart,
  LineChart,
  ProgressList,
  SectionHeader,
  SummaryCard,
  TimelineWidget,
  formatCurrency,
  summaryIcons,
} from "./widgets";

const chartColors = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#64748b",
];

const statusToneMap = {
  Draft: "slate",
  Pending: "amber",
  Confirmed: "brand",
  Running: "brand",
  "In Transit": "brand",
  Completed: "emerald",
  Closed: "emerald",
  Cancelled: "rose",
  Paid: "emerald",
  Sent: "sky",
};

const expenseCategories = [
  "Fuel",
  "Driver",
  "Maintenance",
  "Office",
  "Partner Withdrawal",
  "Employee Advance",
  "Other",
];

function parseAmount(value) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function toTitle(value) {
  return String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sum(records, resolver) {
  return records.reduce((total, record) => total + resolver(record), 0);
}

function countBy(records, resolver) {
  return records.reduce((acc, record) => {
    const key = resolver(record) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function amountBy(records, resolver, amountResolver) {
  return records.reduce((acc, record) => {
    const key = resolver(record) || "Unknown";
    acc[key] = (acc[key] || 0) + amountResolver(record);
    return acc;
  }, {});
}

function asChartData(map, formatter = (label) => toTitle(label)) {
  return Object.entries(map).map(([label, value], index) => ({
    label: formatter(label),
    value,
    color: chartColors[index % chartColors.length],
  }));
}

function sortByDate(records, key) {
  return [...records].sort((a, b) =>
    String(a[key] || "").localeCompare(String(b[key] || "")),
  );
}

function tenantBusinessDate(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function previousCalendarDate(currentDate) {
  const value = new Date(`${currentDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function seriesByDate(records, dateKey, amountResolver) {
  const grouped = amountBy(
    records,
    (record) => record[dateKey],
    amountResolver,
  );
  return Object.entries(grouped)
    .sort(([dateA], [dateB]) => String(dateA).localeCompare(String(dateB)))
    .map(([label, value]) => ({ label: String(label).slice(5), value }));
}

function sparkline(records, dateKey, amountResolver) {
  const series = seriesByDate(records, dateKey, amountResolver);
  return series.slice(-7).map((item) => item.value);
}

function normalizeBookingStatus(status) {
  if (status === "In Transit") return "Running";
  return status || "Draft";
}

function normalizeExpenseCategory(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("fuel")) return "Fuel";
  if (value.includes("driver")) return "Driver";
  if (
    value.includes("maintenance") ||
    value.includes("repair") ||
    value.includes("tyre") ||
    value.includes("permit")
  )
    return "Maintenance";
  if (value.includes("office") || value.includes("cleaning")) return "Office";
  if (value.includes("partner") || value.includes("owner"))
    return "Partner Withdrawal";
  if (value.includes("employee")) return "Employee Advance";
  return "Other";
}

function buildVehiclePerformance(bookings, expenses) {
  const vehicleRevenue = amountBy(
    bookings.filter((booking) => booking.vehicleRegistrationNo),
    (booking) => booking.vehicleRegistrationNo,
    (booking) => parseAmount(booking.fixedAmount || booking.amount),
  );
  const vehicleKeys = Object.keys(vehicleRevenue);
  const totalRevenue =
    sum(Object.values(vehicleRevenue), (value) => value) || 1;
  const fuelPool = sum(
    expenses.filter(
      (expense) => normalizeExpenseCategory(expense.category) === "Fuel",
    ),
    (expense) => parseAmount(expense.amount),
  );
  const maintenancePool = sum(
    expenses.filter(
      (expense) => normalizeExpenseCategory(expense.category) === "Maintenance",
    ),
    (expense) => parseAmount(expense.amount),
  );
  const driverPool = sum(
    expenses.filter(
      (expense) => normalizeExpenseCategory(expense.category) === "Driver",
    ),
    (expense) => parseAmount(expense.amount),
  );

  return vehicleKeys
    .map((vehicle) => {
      const revenue = vehicleRevenue[vehicle];
      const ratio = revenue / totalRevenue;
      const fuelCost = Math.round(fuelPool * ratio);
      const maintenance = Math.round(maintenancePool * ratio);
      const driverCost = Math.round(driverPool * ratio);
      const netProfit = revenue - fuelCost - maintenance - driverCost;
      const profitPercent = revenue
        ? Math.round((netProfit / revenue) * 100)
        : 0;

      return {
        id: vehicle,
        vehicle,
        revenue,
        fuelCost,
        maintenance,
        driverCost,
        netProfit,
        profitPercent,
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);
}

function metricRecord(label, value) {
  return { label, value };
}

function buildDashboardData(source) {
  const bookings = source.bookings;
  const customers = source.customers;
  const invoices = source.invoices;
  const expenses = source.expenses;
  const deposits = source.deposits;
  const transactions = source.transactions;
  const managerLedgerEntries = source.managerLedgerEntries;
  const auditExceptions = source.auditExceptions;
  const drivers = source.drivers;
  const partners = [];

  const businessDate = source.businessDate;
  const previousDate = previousCalendarDate(businessDate);
  const monthKey = businessDate.slice(0, 7);

  const todayBookings = bookings.filter(
    (booking) => booking.pickupDate === businessDate,
  );
  const yesterdayBookings = bookings.filter(
    (booking) => booking.pickupDate === previousDate,
  );
  const monthBookings = bookings.filter((booking) =>
    String(booking.pickupDate || "").startsWith(monthKey),
  );
  const todayInvoices = invoices.filter(
    (invoice) => invoice.dueDate === businessDate,
  );
  const yesterdayInvoices = invoices.filter(
    (invoice) => invoice.dueDate === previousDate,
  );
  const monthInvoices = invoices.filter((invoice) =>
    String(invoice.dueDate || "").startsWith(monthKey),
  );
  const todayExpenses = expenses.filter(
    (expense) => expense.date === businessDate,
  );
  const yesterdayExpenses = expenses.filter(
    (expense) => expense.date === previousDate,
  );
  const monthExpenses = expenses.filter((expense) =>
    String(expense.date || "").startsWith(monthKey),
  );

  const todayRevenue = sum(todayInvoices, (invoice) =>
    parseAmount(invoice.total),
  );
  const yesterdayRevenue = sum(yesterdayInvoices, (invoice) =>
    parseAmount(invoice.total),
  );
  const todayCollections = sum(
    todayInvoices.filter((invoice) => invoice.status === "Paid"),
    (invoice) => parseAmount(invoice.total),
  );
  const yesterdayCollections = sum(
    yesterdayInvoices.filter((invoice) => invoice.status === "Paid"),
    (invoice) => parseAmount(invoice.total),
  );
  const todayExpenseAmount = sum(todayExpenses, (expense) =>
    parseAmount(expense.amount),
  );
  const yesterdayExpenseAmount = sum(yesterdayExpenses, (expense) =>
    parseAmount(expense.amount),
  );
  const todayBookingRevenue = sum(todayBookings, (booking) =>
    parseAmount(booking.fixedAmount || booking.amount),
  );
  const todayVehicleProfit = todayBookingRevenue - todayExpenseAmount;
  const yesterdayVehicleProfit =
    sum(yesterdayBookings, (booking) =>
      parseAmount(booking.fixedAmount || booking.amount),
    ) - yesterdayExpenseAmount;
  const pendingInvoices = invoices.filter(
    (invoice) =>
      invoice.status !== "Cancelled" && parseAmount(invoice.pendingBalance) > 0,
  );
  const pendingCollections = sum(pendingInvoices, (invoice) =>
    parseAmount(invoice.pendingBalance),
  );
  const managerBalance = sum(
    managerLedgerEntries,
    (entry) => parseAmount(entry.credit) - parseAmount(entry.debit),
  );
  const managerBalanceByName = amountBy(
    managerLedgerEntries,
    (entry) => entry.manager || entry.managerName,
    (entry) => parseAmount(entry.credit) - parseAmount(entry.debit),
  );

  const categoryTotals = expenseCategories.reduce(
    (acc, category) => ({ ...acc, [category]: 0 }),
    {},
  );
  expenses.forEach((expense) => {
    const category = normalizeExpenseCategory(expense.category);
    categoryTotals[category] =
      (categoryTotals[category] || 0) + parseAmount(expense.amount);
  });
  const expenseTotal = sum(expenses, (expense) => parseAmount(expense.amount));
  const fuelTotal = categoryTotals.Fuel || 0;
  const officeTotal = categoryTotals.Office || 0;
  const driverTotal = categoryTotals.Driver || 0;
  const monthlyExpense = sum(monthExpenses, (expense) =>
    parseAmount(expense.amount),
  );
  const monthlyRevenue = sum(monthInvoices, (invoice) =>
    parseAmount(invoice.total),
  );
  const monthlyCollections = sum(
    monthInvoices.filter((invoice) => invoice.status === "Paid"),
    (invoice) => parseAmount(invoice.total),
  );
  const monthlyProfit = monthlyRevenue - monthlyExpense;

  const vehiclePerformance = buildVehiclePerformance(bookings, expenses);
  const highestFuelVehicle =
    [...vehiclePerformance].sort((a, b) => b.fuelCost - a.fuelCost)[0] || {};
  const bookingProfitRows = bookings.map((booking) => {
    const revenue = parseAmount(booking.fixedAmount || booking.amount);
    const estimatedExpense =
      expenseTotal && bookings.length
        ? Math.round(expenseTotal / bookings.length)
        : 0;
    const profit = revenue - estimatedExpense;
    return {
      id: booking.id,
      booking: booking.id,
      customer: booking.customer,
      revenue,
      profit,
      margin: revenue ? Math.round((profit / revenue) * 100) : 0,
    };
  });
  const totalBookingProfit = sum(
    bookingProfitRows,
    (booking) => booking.profit,
  );

  const corporateOutstanding = sum(
    pendingInvoices.filter((invoice) => {
      const booking = bookings.find((item) => item.id === invoice.booking);
      return booking?.customer_type === "Corporate";
    }),
    (invoice) => parseAmount(invoice.pendingBalance),
  );
  const agentOutstanding = sum(
    pendingInvoices.filter((invoice) => {
      const booking = bookings.find((item) => item.id === invoice.booking);
      return booking?.customer_type === "Travel Agent";
    }),
    (invoice) => parseAmount(invoice.pendingBalance),
  );
  const retailOutstanding = sum(
    pendingInvoices.filter((invoice) => {
      const booking = bookings.find((item) => item.id === invoice.booking);
      return booking?.customer_type === "Individuals";
    }),
    (invoice) => parseAmount(invoice.pendingBalance),
  );
  return {
    businessDate,
    summaryCards: [
      {
        label: "Today's Bookings",
        value: todayBookings.length,
        previous: yesterdayBookings.length,
        sparkline: sparkline(bookings, "pickupDate", () => 1),
        icon: summaryIcons.bookings,
        tone: "brand",
      },
      {
        label: "Today's Revenue",
        value: formatCurrency(todayRevenue),
        previous: yesterdayRevenue,
        current: todayRevenue,
        sparkline: sparkline(invoices, "dueDate", (invoice) =>
          parseAmount(invoice.total),
        ),
        icon: summaryIcons.revenue,
        tone: "emerald",
      },
      {
        label: "Today's Collections",
        value: formatCurrency(todayCollections),
        previous: yesterdayCollections,
        current: todayCollections,
        sparkline: sparkline(
          invoices.filter((invoice) => invoice.status === "Paid"),
          "dueDate",
          (invoice) => parseAmount(invoice.total),
        ),
        icon: summaryIcons.invoices,
        tone: "emerald",
      },
      {
        label: "Today's Expenses",
        value: formatCurrency(todayExpenseAmount),
        previous: yesterdayExpenseAmount,
        current: todayExpenseAmount,
        sparkline: sparkline(expenses, "date", (expense) =>
          parseAmount(expense.amount),
        ),
        icon: summaryIcons.utilization,
        tone: "amber",
      },
      {
        label: "Today's Vehicle Profit",
        value: formatCurrency(todayVehicleProfit),
        previous: yesterdayVehicleProfit,
        current: todayVehicleProfit,
        sparkline: [todayVehicleProfit, monthlyProfit, totalBookingProfit].map(
          (value) => Math.max(value, 0),
        ),
        icon: summaryIcons.growth,
        tone: "brand",
      },
      {
        label: "Today's Pending Collections",
        value: formatCurrency(pendingCollections),
        previous: pendingCollections,
        current: pendingCollections,
        sparkline: sparkline(pendingInvoices, "dueDate", (invoice) =>
          parseAmount(invoice.pendingBalance),
        ),
        icon: summaryIcons.invoices,
        tone: "rose",
      },
      {
        label: "Cash Pending Deposit",
        value: formatCurrency(
          sum(
            deposits.filter(
              (deposit) =>
                !["Verified", "Deposited"].includes(
                  deposit.depositStatus || deposit.deposit_status,
                ),
            ),
            (deposit) =>
              parseAmount(deposit.amountCollected || deposit.amount_collected),
          ),
        ),
        previous: 0,
        current: deposits.length,
        sparkline: deposits
          .map((deposit) =>
            parseAmount(deposit.amountCollected || deposit.amount_collected),
          )
          .slice(-7),
        icon: summaryIcons.revenue,
        tone: "amber",
      },
      {
        label: "Manager Ledger Balance",
        value: formatCurrency(managerBalance),
        previous: 0,
        current: managerBalance,
        sparkline: managerLedgerEntries
          .map((entry) =>
            Math.max(parseAmount(entry.credit) - parseAmount(entry.debit), 0),
          )
          .slice(-7),
        icon: summaryIcons.utilization,
        tone: "slate",
      },
    ],
    revenueCards: [
      metricRecord(
        "Corporate Outstanding",
        formatCurrency(corporateOutstanding),
      ),
      metricRecord(
        "Travel Agent Outstanding",
        formatCurrency(agentOutstanding),
      ),
      metricRecord("Individual Outstanding", formatCurrency(retailOutstanding)),
    ],
    vehiclePerformance,
    profitCards: [
      metricRecord(
        "Average Profit Per Booking",
        formatCurrency(
          bookingProfitRows.length
            ? totalBookingProfit / bookingProfitRows.length
            : 0,
        ),
      ),
      metricRecord(
        "Today's Booking Profit",
        formatCurrency(todayVehicleProfit),
      ),
      metricRecord("Monthly Booking Profit", formatCurrency(monthlyProfit)),
    ],
    topProfitableBookings: [...bookingProfitRows]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5),
    lowestProfitBookings: [...bookingProfitRows]
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 5),
    managerCards: [
      metricRecord("Current Balance", formatCurrency(managerBalance)),
      metricRecord("Today's Expenses", formatCurrency(todayExpenseAmount)),
      metricRecord(
        "Fund Released",
        formatCurrency(
          sum(managerLedgerEntries, (entry) => parseAmount(entry.credit)),
        ),
      ),
      metricRecord("Pending Verification", auditExceptions.length),
    ],
    managerRows: Object.entries(managerBalanceByName).map(
      ([manager, balance]) => ({
        id: manager,
        manager,
        balance: formatCurrency(balance),
        status: balance >= 0 ? "Open" : "Mismatch",
      }),
    ),
    expenseChart: asChartData(categoryTotals),
    expenseCards: [
      metricRecord("Today's Expense", formatCurrency(todayExpenseAmount)),
      metricRecord("Monthly Expense", formatCurrency(monthlyExpense)),
      metricRecord(
        "Fuel %",
        `${expenseTotal ? Math.round((fuelTotal / expenseTotal) * 100) : 0}%`,
      ),
      metricRecord(
        "Office %",
        `${expenseTotal ? Math.round((officeTotal / expenseTotal) * 100) : 0}%`,
      ),
      metricRecord(
        "Driver %",
        `${expenseTotal ? Math.round((driverTotal / expenseTotal) * 100) : 0}%`,
      ),
    ],
    fuelCards: [
      metricRecord(
        "Fuel Cost Today",
        formatCurrency(
          sum(
            todayExpenses.filter(
              (expense) =>
                normalizeExpenseCategory(expense.category) === "Fuel",
            ),
            (expense) => parseAmount(expense.amount),
          ),
        ),
      ),
      metricRecord(
        "Monthly Fuel Cost",
        formatCurrency(
          sum(
            monthExpenses.filter(
              (expense) =>
                normalizeExpenseCategory(expense.category) === "Fuel",
            ),
            (expense) => parseAmount(expense.amount),
          ),
        ),
      ),
      metricRecord(
        "Average Fuel Cost per KM",
        formatCurrency(
          sum(bookings, (booking) => parseAmount(booking.estimatedKm))
            ? fuelTotal /
                sum(bookings, (booking) => parseAmount(booking.estimatedKm))
            : 0,
        ),
      ),
      metricRecord(
        "Vehicle with Highest Fuel Cost",
        highestFuelVehicle.vehicle || "-",
      ),
    ],
    fuelTrend: seriesByDate(
      expenses.filter(
        (expense) => normalizeExpenseCategory(expense.category) === "Fuel",
      ),
      "date",
      (expense) => parseAmount(expense.amount),
    ),
    officeCards: [
      metricRecord(
        "Office Expense Today",
        formatCurrency(
          sum(
            todayExpenses.filter(
              (expense) =>
                normalizeExpenseCategory(expense.category) === "Office",
            ),
            (expense) => parseAmount(expense.amount),
          ),
        ),
      ),
      metricRecord(
        "Month Expense",
        formatCurrency(
          sum(
            monthExpenses.filter(
              (expense) =>
                normalizeExpenseCategory(expense.category) === "Office",
            ),
            (expense) => parseAmount(expense.amount),
          ),
        ),
      ),
      metricRecord("Pending Allocation", formatCurrency(officeTotal)),
      metricRecord("Allocated Expense", formatCurrency(0)),
    ],
    driverCards: [
      metricRecord(
        "Drivers Working Today",
        new Set(todayBookings.map((booking) => booking.driver).filter(Boolean))
          .size,
      ),
      metricRecord("Pending Salary", formatCurrency(0)),
      metricRecord("Advance Outstanding", formatCurrency(0)),
      metricRecord(
        "Top Driver by Revenue",
        Object.entries(
          amountBy(
            bookings,
            (booking) => booking.driver,
            (booking) => parseAmount(booking.fixedAmount || booking.amount),
          ),
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
      ),
      metricRecord(
        "Lowest Performing Driver",
        Object.entries(
          amountBy(
            bookings,
            (booking) => booking.driver,
            (booking) => parseAmount(booking.fixedAmount || booking.amount),
          ),
        ).sort((a, b) => a[1] - b[1])[0]?.[0] || "-",
      ),
    ],
    partnerCards: [
      metricRecord(
        "Partner Withdrawals",
        formatCurrency(categoryTotals["Partner Withdrawal"] || 0),
      ),
      metricRecord("Current Partner Balance", formatCurrency(0)),
      metricRecord(
        "Pending Settlement",
        partners.filter((partner) => partner.status !== "Inactive").length,
      ),
    ],
    cashFlow: {
      steps: [
        {
          label: "Customer Collection",
          value: formatCurrency(monthlyCollections),
        },
        { label: "Company Bank", value: formatCurrency(monthlyCollections) },
        { label: "Manager Ledger", value: formatCurrency(managerBalance) },
        { label: "Expenses", value: formatCurrency(monthlyExpense) },
        {
          label: "Remaining Balance",
          value: formatCurrency(monthlyCollections - monthlyExpense),
        },
      ],
      cards: [
        metricRecord("Opening Balance", formatCurrency(0)),
        metricRecord("Money In", formatCurrency(monthlyCollections)),
        metricRecord("Money Out", formatCurrency(monthlyExpense)),
        metricRecord(
          "Closing Balance",
          formatCurrency(monthlyCollections - monthlyExpense),
        ),
      ],
    },
    alerts: [
      {
        id: "pending-collections",
        title: "Pending collections",
        description: `${pendingInvoices.length} invoices are not fully collected.`,
        iconTone: "bg-amber-100 text-amber-700",
      },
      {
        id: "cash-deposit",
        title: "Cash deposit control",
        description: deposits.length
          ? "Booking cash deposit records are available for verification."
          : "No booking cash deposit records yet.",
        iconTone: "bg-sky-100 text-sky-700",
      },
      {
        id: "audit",
        title: "Audit exceptions",
        description: auditExceptions.length
          ? `${auditExceptions.length} exceptions need action.`
          : "No audit exceptions in mock data.",
        iconTone: "bg-rose-100 text-rose-700",
      },
    ],
    timeline: sortByDate(bookings, "pickupDate")
      .slice(-6)
      .reverse()
      .map((booking) => ({
        id: booking.id,
        title: `${booking.id} - ${booking.customer}`,
        description: `${toTitle(booking.booking_type)} from ${booking.travellingFrom || booking.pickupReportingAddress}`,
        date: booking.pickupDate,
        status: booking.status,
        tone: statusToneMap[booking.status] || "slate",
      })),
    customers,
    drivers,
  };
}

function SmallMetricGrid({ items, threeColumns = false }) {
  return (
    <div
      className={`dashboard-mobile-cards dashboard-mobile-metrics grid grid-cols-1 gap-3 ${threeColumns ? "md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}
    >
      {items.map((item) => (
        <SummaryCard
          key={item.label}
          label={item.label}
          value={item.value}
          tone="slate"
        />
      ))}
    </div>
  );
}

const profitColumns = [
  { key: "booking", label: "Booking" },
  { key: "customer", label: "Customer" },
  {
    key: "revenue",
    label: "Revenue",
    render: (row) => formatCurrency(row.revenue),
  },
  {
    key: "profit",
    label: "Profit",
    render: (row) => formatCurrency(row.profit),
  },
  { key: "margin", label: "Margin", render: (row) => `${row.margin}%` },
];

const managerColumns = [
  { key: "manager", label: "Manager" },
  { key: "balance", label: "Balance" },
  {
    key: "status",
    label: "Status",
    render: (row) => (
      <Badge tone={row.status === "Open" ? "emerald" : "rose"}>
        {row.status}
      </Badge>
    ),
  },
];

function DashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      listBookings({ limit: 100 }),
      getCustomers({ limit: 100 }),
      listInvoices({ limit: 100 }),
      listAccountTransactions(),
      listCashDeposits(),
      listManagerLedgers(),
      getAccountsAudit(),
      listDrivers({ limit: 100 }),
      getCompanyProfile(),
    ])
      .then(
        ([
          bookings,
          customers,
          invoices,
          transactionData,
          depositData,
          ledgerData,
          auditData,
          drivers,
          companyProfile,
        ]) => {
          if (!active) return;
          const transactions = transactionData.transactions || [];
          const expenses = transactions
            .filter(
              (transaction) =>
                transaction.transactionType === "EXPENSE" &&
                transaction.direction === "DEBIT",
            )
            .map((transaction) => ({
              ...transaction,
              date: transaction.transactionDate,
            }));
          const normalizedInvoices = invoices.items.map((invoice) => ({
            ...invoice,
            dueDate: invoice.invoiceDate,
            total: invoice.totals?.netPayable || 0,
            status: invoice.invoiceStatus || invoice.status,
          }));
          const managerLedgerEntries = (ledgerData.ledgers || []).map(
            (ledger) => ({
              manager: ledger.manager?.name,
              date: ledger.updatedAt?.slice(0, 10),
              credit: ledger.currentBalance >= 0 ? ledger.currentBalance : 0,
              debit: ledger.currentBalance < 0 ? -ledger.currentBalance : 0,
            }),
          );
          setState({
            loading: false,
            error: "",
            data: buildDashboardData({
              bookings: bookings.items,
              customers: customers.items,
              invoices: normalizedInvoices,
              expenses,
              deposits: depositData.deposits || depositData.cashDeposits || [],
              transactions,
              managerLedgerEntries,
              auditExceptions:
                auditData.exceptions || auditData.auditExceptions || [],
              drivers: drivers.items,
              businessDate: tenantBusinessDate(companyProfile.timeZone),
            }),
          });
        },
      )
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error:
            error.response?.data?.message ||
            "Unable to load the live dashboard.",
          data: null,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Loading live business data…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Dashboard unavailable</p>
        <p className="mt-1">{state.error}</p>
      </div>
    );
  }

  const dashboard = state.data;

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <SectionHeader title="Business Overview" />
        <div
          className="dashboard-mobile-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Business overview cards — swipe to browse"
        >
          {dashboard.summaryCards.map((card, index) => (
            <FilteredSummaryCard
              key={summaryMetrics[index].key}
              card={card}
              metric={summaryMetrics[index]}
              today={dashboard.businessDate}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Current Outstanding Balances" />
        <OutstandingCards />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Vehicle Performance" />
        <VehiclePerformanceTable />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Booking Profit" />
        <SmallMetricGrid items={dashboard.profitCards} />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <DataTableWidget
            title="Top 5 Profitable Bookings"
            columns={profitColumns}
            rows={dashboard.topProfitableBookings}
          />
          <DataTableWidget
            title="Lowest Profit Bookings"
            columns={profitColumns}
            rows={dashboard.lowestProfitBookings}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Manager Ledger" />
        <SmallMetricGrid items={dashboard.managerCards} />
        <DataTableWidget
          title="Manager Wise Balance"
          columns={managerColumns}
          rows={dashboard.managerRows}
        />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Expense Overview" />
        <SmallMetricGrid items={dashboard.expenseCards} />
        <div className="dashboard-mobile-cards grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <DonutChart
              title="Expense Category Pie"
              data={dashboard.expenseChart}
            />
          </div>
          <div className="xl:col-span-2">
            <ProgressList
              title="Expense Category Weight"
              data={dashboard.expenseChart}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Fuel Analysis" />
        <SmallMetricGrid items={dashboard.fuelCards} />
        <LineChart title="Fuel Trend Line Chart" data={dashboard.fuelTrend} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Office Expense" />
        <SmallMetricGrid items={dashboard.officeCards} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Driver Summary" />
        <SmallMetricGrid items={dashboard.driverCards} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Partner Summary" />
        <SmallMetricGrid items={dashboard.partnerCards} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Cash Flow" />
        <CashFlowWidget
          title="Cash Movement Flow"
          steps={dashboard.cashFlow.steps}
          cards={dashboard.cashFlow.cards}
        />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Alerts & Pending Actions" />
        <AlertList title="Control Alerts" alerts={dashboard.alerts} />
      </section>

      <section className="space-y-4">
        <SectionHeader title="Recent Activities" />
        <TimelineWidget title="Activity Timeline" items={dashboard.timeline} />
      </section>
    </div>
  );
}

export default DashboardPage;
