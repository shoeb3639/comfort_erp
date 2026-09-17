import "./mobile-cards.css";
import VehiclePerformanceTable from "./VehiclePerformanceTable";
import OutstandingCards from "./OutstandingCards";
import FilteredSummaryCard, { summaryMetrics } from "./FilteredSummaryCard";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
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
import {
  getCompanyProfile,
  getDashboardLayout,
  updatePersonalDashboardLayout,
  updateTenantDashboardLayout,
} from "../../services/tenantSetup";
import {
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

const dashboardSectionLabels = {
  business_overview: "Business Overview",
  outstanding: "Current Outstanding Balances",
  vehicle_performance: "Vehicle Performance",
  manager_ledger: "Manager Ledger",
  expense_categories: "Expense Categories",
  fuel_analysis: "Fuel Analysis",
  cash_flow: "Cash Flow",
  recent_activities: "Recent Activities",
};

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
      metricRecord("Total Expenses Today", formatCurrency(todayExpenseAmount)),
      metricRecord("Total Expenses This Month", formatCurrency(monthlyExpense)),
      metricRecord(
        "Office Expenses Today",
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
        "Office Expenses This Month",
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
  const { user } = useAuth();
  const [expenseView, setExpenseView] = useState("chart");
  const [layout, setLayout] = useState([]);
  const [layoutSource, setLayoutSource] = useState("SYSTEM");
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [draftLayout, setDraftLayout] = useState([]);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [draggedSectionIndex, setDraggedSectionIndex] = useState(null);
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
      getDashboardLayout(),
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
          dashboardLayout,
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
          setLayout(dashboardLayout.layout);
          setLayoutSource(dashboardLayout.source);
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

  const canManageTenantLayout =
    user?.isPrimaryOwner ||
    (user?.permissions || []).includes("settings.company.manage");

  function openLayoutEditor() {
    setDraftLayout(layout.map((item) => ({ ...item })));
    setLayoutError("");
    setLayoutEditorOpen(true);
  }

  function moveSection(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftLayout.length) return;
    setDraftLayout((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function toggleSection(key) {
    setDraftLayout((current) =>
      current.map((item) =>
        item.key === key ? { ...item, visible: !item.visible } : item,
      ),
    );
  }

  function dropSection(targetIndex) {
    if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
      setDraggedSectionIndex(null);
      return;
    }
    setDraftLayout((current) => {
      const next = [...current];
      const [moved] = next.splice(draggedSectionIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedSectionIndex(null);
  }

  function applyLayoutResponse(response) {
    setLayout(response.layout);
    setLayoutSource(response.source);
    setDraftLayout(response.layout.map((item) => ({ ...item })));
  }

  async function saveLayout(scope) {
    setLayoutSaving(true);
    setLayoutError("");
    try {
      const response =
        scope === "tenant"
          ? await updateTenantDashboardLayout(draftLayout)
          : await updatePersonalDashboardLayout(draftLayout);
      applyLayoutResponse(response);
      setLayoutEditorOpen(false);
    } catch (error) {
      setLayoutError(
        error.response?.data?.message || "Unable to save dashboard layout.",
      );
    } finally {
      setLayoutSaving(false);
    }
  }

  async function resetLayout(scope) {
    setLayoutSaving(true);
    setLayoutError("");
    try {
      const response =
        scope === "tenant"
          ? await updateTenantDashboardLayout(null)
          : await updatePersonalDashboardLayout(null);
      applyLayoutResponse(response);
    } catch (error) {
      setLayoutError(
        error.response?.data?.message || "Unable to reset dashboard layout.",
      );
    } finally {
      setLayoutSaving(false);
    }
  }

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
  const dashboardSections = {
    business_overview: (
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
    ),
    outstanding: (
      <section className="space-y-4">
        <SectionHeader title="Current Outstanding Balances" />
        <OutstandingCards />
      </section>
    ),
    vehicle_performance: (
      <section className="space-y-4">
        <SectionHeader title="Vehicle Performance" />
        <VehiclePerformanceTable today={dashboard.businessDate} />
      </section>
    ),
    manager_ledger: (
      <section className="space-y-4">
        <SectionHeader title="Manager Ledger" />
        <SmallMetricGrid items={dashboard.managerCards} />
        <DataTableWidget
          title="Manager Wise Balance"
          columns={managerColumns}
          rows={dashboard.managerRows}
        />
      </section>
    ),
    expense_categories: (
      <section className="space-y-4">
        <SectionHeader title="Expense Overview" />
        <SmallMetricGrid items={dashboard.expenseCards} />
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-950">Expense Categories</h3>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {[
                ["chart", "Chart View"],
                ["list", "List View"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExpenseView(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    expenseView === value
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>
          <div className="p-5">
            {expenseView === "chart" ? (
              <DonutChart
                title="Expense Breakdown"
                data={dashboard.expenseChart}
              />
            ) : (
              <ProgressList
                title="Expense by Category"
                data={dashboard.expenseChart}
              />
            )}
          </div>
        </div>
      </section>
    ),
    fuel_analysis: (
      <section className="space-y-4">
        <SectionHeader title="Fuel Analysis" />
        <SmallMetricGrid items={dashboard.fuelCards} />
        <LineChart title="Fuel Trend Line Chart" data={dashboard.fuelTrend} />
      </section>
    ),
    cash_flow: (
      <section className="space-y-4">
        <SectionHeader title="Cash Flow" />
        <CashFlowWidget
          title="Cash Movement Flow"
          steps={dashboard.cashFlow.steps}
          cards={dashboard.cashFlow.cards}
        />
      </section>
    ),
    recent_activities: (
      <section className="space-y-4">
        <SectionHeader title="Recent Activities" />
        <TimelineWidget title="Activity Timeline" items={dashboard.timeline} />
      </section>
    ),
  };

  return (
    <div>
      <button
        type="button"
        onClick={openLayoutEditor}
        title="Customize dashboard"
        aria-label="Customize dashboard"
        className="fixed right-4 top-20 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 hover:text-brand-700"
      >
        <Settings2 size={18} />
      </button>

      <div className="space-y-7">
        {layout
          .filter((item) => item.visible)
          .map((item) => (
            <div key={item.key}>{dashboardSections[item.key]}</div>
          ))}
      </div>

      {layoutEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-950">
                  Customize Dashboard
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Current layout: {layoutSource.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLayoutEditorOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </header>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-5">
              {draftLayout.map((item, index) => (
                <div
                  key={item.key}
                  draggable
                  onDragStart={() => setDraggedSectionIndex(index)}
                  onDragEnd={() => setDraggedSectionIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropSection(index)}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    draggedSectionIndex === index
                      ? "border-brand-300 bg-brand-50 opacity-70"
                      : "border-slate-200"
                  }`}
                >
                  <GripVertical
                    size={17}
                    className="cursor-grab text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={() => toggleSection(item.key)}
                    aria-label={`Show ${dashboardSectionLabels[item.key]}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                    {dashboardSectionLabels[item.key]}
                  </span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveSection(index, -1)}
                    aria-label={`Move ${dashboardSectionLabels[item.key]} up`}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={index === draftLayout.length - 1}
                    onClick={() => moveSection(index, 1)}
                    aria-label={`Move ${dashboardSectionLabels[item.key]} down`}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
              ))}
            </div>

            {layoutError && (
              <p className="mx-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {layoutError}
              </p>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={layoutSaving}
                  onClick={() => resetLayout("personal")}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Use Tenant Default
                </button>
                {canManageTenantLayout && (
                  <button
                    type="button"
                    disabled={layoutSaving}
                    onClick={() => resetLayout("tenant")}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Reset Tenant Default
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {canManageTenantLayout && (
                  <button
                    type="button"
                    disabled={layoutSaving}
                    onClick={() => saveLayout("tenant")}
                    className="rounded-lg border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
                  >
                    Save for Tenant
                  </button>
                )}
                <button
                  type="button"
                  disabled={layoutSaving}
                  onClick={() => saveLayout("personal")}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {layoutSaving ? "Saving…" : "Save My Layout"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
