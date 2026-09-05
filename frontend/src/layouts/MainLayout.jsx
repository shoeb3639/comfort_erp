import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  WalletCards,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const accountPermissions = [
  "accounts.collection.view",
  "accounts.deposit.manage",
  "accounts.ledger.view",
  "accounts.fund.release",
  "accounts.expense.manage",
  "accounts.daily_closing.manage",
  "accounts.audit.verify",
];

const navItems = [
  {
    id: "dashboard",
    to: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
  },
  {
    id: "bookings",
    to: "/bookings",
    label: "Bookings",
    shortLabel: "Jobs",
    icon: CalendarCheck,
  },
  {
    id: "master",
    label: "Master",
    shortLabel: "Master",
    icon: CarFront,
    children: [
      { to: "/customers", label: "Customers" },
      { to: "/vendors", label: "Vendors" },
      { to: "/vehicles", label: "Vehicles" },
      { to: "/drivers", label: "Drivers" },
    ],
  },
  {
    id: "invoices",
    to: "/invoices",
    label: "Invoices",
    shortLabel: "Bills",
    icon: ReceiptText,
  },
  {
    id: "accounts",
    label: "Accounts",
    shortLabel: "Accts",
    icon: WalletCards,
    permissions: accountPermissions,
    children: [
      {
        to: "/accounts",
        label: "Accounts Overview",
        exact: true,
        permissions: accountPermissions,
      },
      {
        to: "/accounts/collections",
        label: "Collections",
        permissions: ["accounts.collection.view"],
      },
      {
        to: "/accounts/manager-ledger",
        label: "Manager Ledger",
        permissions: ["accounts.ledger.view"],
      },
      {
        to: "/accounts/manager-ledger/release",
        label: "Fund Release",
        permissions: ["accounts.fund.release"],
      },
      {
        to: "/accounts/transactions",
        label: "Expense Entry",
        aliases: ["/accounts/expense-entry", "/expenses"],
        permissions: ["accounts.expense.manage"],
      },
      {
        to: "/accounts/booking-cash-deposit",
        label: "Booking Cash Deposit",
        permissions: ["accounts.deposit.manage"],
      },
      {
        to: "/accounts/daily-closing",
        label: "Daily Closing",
        permissions: ["accounts.daily_closing.manage"],
      },
      {
        to: "/accounts/audit-verification",
        label: "Audit & Verification",
        permissions: ["accounts.audit.verify"],
      },
    ],
  },
  {
    id: "reports",
    to: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: BarChart3,
    permissions: ["reports.view"],
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "More",
    icon: Settings,
    children: [
      { to: "/settings", label: "Company Setup", exact: true },
      { to: "/settings/gst-registrations", label: "GST Registrations" },
      { to: "/settings/users", label: "Users" },
      { to: "/settings/roles", label: "Roles" },
      { to: "/settings/permissions", label: "Permissions" },
    ],
  },
];

const bottomNavItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
  },
  {
    to: "/bookings",
    label: "Bookings",
    shortLabel: "Jobs",
    icon: CalendarCheck,
  },
  { to: "/customers", label: "Customers", shortLabel: "Clients", icon: Users },
  {
    to: "/invoices",
    label: "Invoices",
    shortLabel: "Bills",
    icon: ReceiptText,
  },
  {
    to: "/accounts",
    label: "Accounts",
    shortLabel: "Accts",
    icon: WalletCards,
    permissions: accountPermissions,
  },
];

const pageMeta = {
  "/dashboard": {
    eyebrow: "",
    title: "Business Control Center",
    description: "Monitor bookings, vehicles, billing, and operations.",
  },
  "/bookings": {
    eyebrow: "Reservations",
    title: "Booking workspace",
    description: "Search, create, assign, and manage trip reservations.",
  },
  "/customers": {
    eyebrow: "Customer care",
    title: "Customer records",
    description: "Manage retail, corporate, and travel agent billing parties.",
  },
  "/vendors": {
    eyebrow: "Supplier network",
    title: "Vendor & fleet management",
    description: "Manage vendors with their child vehicles and drivers.",
  },
  "/vehicles": {
    eyebrow: "Fleet master",
    title: "Vehicles",
    description: "Manage own and vendor-provided vehicles from one master.",
  },
  "/drivers": {
    eyebrow: "Driver master",
    title: "Drivers",
    description: "Manage own and vendor-provided drivers from one master.",
  },
  "/invoices": {
    eyebrow: "Billing",
    title: "Invoice center",
    description: "Review billing status and payment due dates.",
  },
  "/accounts": {
    eyebrow: "Accounts",
    title: "Accounts control",
    description:
      "Manage manager ledger, operational transactions, booking cash deposits, daily closing, and audit verification.",
  },
  "/settings": {
    eyebrow: "Workspace",
    title: "Settings",
    description: "Configure integrations, roles, and system preferences.",
  },
  "/reports": {
    eyebrow: "Business intelligence",
    title: "Reports",
    description:
      "Generate tenant-scoped operational and financial reports from live records.",
  },
};

function getPageMeta(pathname) {
  if (/^\/vehicles\/[^/]+\/ledger$/.test(pathname)) {
    return {
      eyebrow: "Fleet profitability",
      title: "Vehicle Register",
      description:
        "Booking-wise vehicle ledger with daily and monthly profit and loss.",
    };
  }

  if (pathname === "/bookings/new") {
    return {
      eyebrow: "Reservations",
      title: "New Booking",
      description:
        "Create a new trip reservation with billing, traveller, route, and duty details.",
    };
  }

  if (/^\/bookings\/[^/]+$/.test(pathname)) {
    return {
      eyebrow: "Reservations",
      title: "View Booking",
      description:
        "Readonly booking summary, assignment, billing, and close status.",
    };
  }

  if (/^\/bookings\/[^/]+\/edit$/.test(pathname)) {
    return {
      eyebrow: "Reservations",
      title: "Edit Booking",
      description: "Update trip reservation details.",
    };
  }

  if (/^\/bookings\/[^/]+\/close$/.test(pathname)) {
    return {
      eyebrow: "Trip closing",
      title: "Close Booking",
      description:
        "Close completed trip, calculate customer billing, and track vehicle profit.",
    };
  }

  if (/^\/bookings\/[^/]+\/collections$/.test(pathname)) {
    return {
      eyebrow: "Collections",
      title: "Booking Collection",
      description:
        "Track booking payments and company-account deposit status separately from manager expense funds.",
    };
  }

  if (/^\/bookings\/[^/]+\/profit$/.test(pathname)) {
    return {
      eyebrow: "Profitability",
      title: "Booking Profit",
      description:
        "Per-booking profitability and vehicle impact. Recoverable charges and GST are excluded from vehicle profit.",
    };
  }

  if (pathname === "/customers/new") {
    return {
      eyebrow: "Customer care",
      title: "Create Customer",
      description:
        "Create a billing party for retail, corporate, or travel agent work.",
    };
  }

  if (/^\/customers\/[^/]+\/edit$/.test(pathname)) {
    return {
      eyebrow: "Customer care",
      title: "Edit Customer",
      description: "Update billing, contact, and account settings.",
    };
  }

  if (pathname === "/invoices/new") {
    return {
      eyebrow: "Billing",
      title: "Create Invoice",
      description:
        "Create invoice using the common invoice template and generic line items.",
    };
  }

  if (/^\/invoices\/[^/]+\/preview$/.test(pathname)) {
    return {
      eyebrow: "Billing",
      title: "Invoice Preview",
      description: "Single common invoice template for all billing types.",
    };
  }

  if (/^\/invoices\/[^/]+\/print$/.test(pathname)) {
    return {
      eyebrow: "Billing",
      title: "Print Invoice",
      description: "Use the browser print dialog to save as PDF or print.",
    };
  }

  if (pathname === "/invoices/settings") {
    return {
      eyebrow: "Billing",
      title: "Invoice Settings",
      description: "Configure invoice numbering and billing defaults.",
    };
  }

  if (pathname === "/accounts/manager-ledger") {
    return {
      eyebrow: "Accounts",
      title: "Manager Ledger",
      description:
        "Track each manager running balance for company fund releases, operational expenses, returns, and adjustments.",
    };
  }

  if (pathname === "/accounts/manager-ledger/new") {
    return {
      eyebrow: "Accounts",
      title: "Create Manager Ledger",
      description:
        "Create a database-backed operational wallet for one manager and location.",
    };
  }

  if (pathname === "/accounts/manager-ledger/release") {
    return {
      eyebrow: "Accounts",
      title: "Release Amount",
      description:
        "Credit manager ledger with company released operational funds. Customer collections remain separate.",
    };
  }

  if (/^\/accounts\/manager-ledger\/[^/]+$/.test(pathname)) {
    return {
      eyebrow: "Accounts",
      title: "Manager Ledger Detail",
      description:
        "Review running manager ledger entries, credits, debits, and balance movement.",
    };
  }

  if (pathname === "/accounts/transactions") {
    return {
      eyebrow: "Accounts",
      title: "Transactions",
      description:
        "Record all operational transactions paid from Manager Ledger. Customer collection is company revenue and never expense cash.",
    };
  }

  if (pathname === "/accounts/booking-cash-deposit") {
    return {
      eyebrow: "Accounts",
      title: "Booking Cash Deposit",
      description:
        "Track cash received from bookings and deposit to company account. This is separate from Manager Ledger.",
    };
  }

  if (pathname === "/accounts/daily-closing") {
    return {
      eyebrow: "Accounts",
      title: "Daily Closing",
      description:
        "Date-wise manager fund opening balance, funds received, expenses, and carry-forward balance.",
    };
  }

  if (pathname === "/accounts/audit-verification") {
    return {
      eyebrow: "Accounts",
      title: "Audit & Verification",
      description:
        "Verify and audit manager funds, booking cash deposits, balances, and operational transactions.",
    };
  }

  if (pathname === "/settings/users") {
    return {
      eyebrow: "Access control",
      title: "Users",
      description:
        "Manage ERP users, branch assignments, status, and role mapping.",
    };
  }

  if (pathname === "/settings/gst-registrations") {
    return {
      eyebrow: "GST settings",
      title: "GST Registrations",
      description:
        "Manage GST registrations, defaults, and branch mappings for the tenant.",
    };
  }

  if (pathname === "/settings/gst-registrations/new") {
    return {
      eyebrow: "GST settings",
      title: "Add GST Registration",
      description:
        "Create a GST registration for legal identity, state, and invoice-series readiness.",
    };
  }

  if (/^\/settings\/gst-registrations\/[^/]+\/edit$/.test(pathname)) {
    return {
      eyebrow: "GST settings",
      title: "Edit GST Registration",
      description:
        "Update GST registration details, status, default setting, and address.",
    };
  }

  if (/^\/settings\/gst-registrations\/[^/]+$/.test(pathname)) {
    return {
      eyebrow: "GST settings",
      title: "GST Registration Detail",
      description: "Review registration details and assigned branches.",
    };
  }

  if (pathname === "/settings/roles") {
    return {
      eyebrow: "Access control",
      title: "Roles",
      description: "Manage role collections and review permission assignments.",
    };
  }

  if (pathname === "/settings/permissions") {
    return {
      eyebrow: "Access control",
      title: "Permissions",
      description:
        "Review the permission-key catalog used for future route and action guards.",
    };
  }

  if (pathname === "/access-denied") {
    return {
      eyebrow: "Security",
      title: "Access Denied",
      description: "Permission required to continue.",
    };
  }

  return null;
}

function getTopbarActions(pathname) {
  if (pathname === "/bookings") {
    return [
      {
        to: "/bookings/new",
        label: "New Booking",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (
    pathname === "/bookings/new" ||
    /^\/bookings\/[^/]+\/edit$/.test(pathname)
  ) {
    return [
      {
        to: "/bookings",
        label: "Back to List",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/bookings\/[^/]+$/.test(pathname)) {
    const bookingId = pathname.split("/")[2];
    return [
      {
        to: `/bookings/${bookingId}/edit`,
        label: "Edit",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/bookings",
        label: "Back to Bookings",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/bookings\/[^/]+\/close$/.test(pathname)) {
    return [
      {
        form: "close-booking-form",
        type: "submit",
        label: "Close Booking",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/bookings",
        label: "Cancel",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/bookings\/[^/]+\/collections$/.test(pathname)) {
    return [
      {
        to: "/bookings",
        label: "Back to Bookings",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/bookings\/[^/]+\/profit$/.test(pathname)) {
    return [
      {
        to: "/bookings",
        label: "Back to Bookings",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (pathname === "/customers") {
    return [
      {
        to: "/customers/new",
        label: "New Customer",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (pathname.startsWith("/customers/")) {
    return [
      {
        to: "/customers",
        label: "Back to Customers",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (pathname === "/vendors") {
    return [
      {
        to: "/vendors?create=vendor",
        label: "Add Vendor",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (pathname === "/invoices") {
    return [
      {
        to: "/invoices/settings",
        label: "Series Settings",
        icon: Settings,
        variant: "secondary",
      },
      {
        to: "/invoices/new",
        label: "New Invoice",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (/^\/invoices\/[^/]+\/preview$/.test(pathname)) {
    const invoiceId = pathname.split("/")[2];
    return [
      {
        to: `/invoices/${invoiceId}/print`,
        label: "Print",
        icon: ReceiptText,
        variant: "secondary",
      },
      {
        onClick: () => window.print(),
        label: "Download PDF",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (pathname.startsWith("/invoices/") && pathname !== "/invoices/settings") {
    return [
      {
        to: "/invoices",
        label: "Back to Invoices",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (pathname === "/invoices/settings") {
    return [
      {
        form: "invoice-settings-form",
        type: "submit",
        label: "Save Settings",
        icon: Plus,
        variant: "primary",
      },
      { to: "/invoices", label: "Back", icon: ArrowLeft, variant: "secondary" },
    ];
  }

  if (pathname === "/accounts/manager-ledger") {
    return [
      {
        to: "/accounts/manager-ledger/new",
        label: "Create Ledger",
        icon: Plus,
        variant: "primary",
        permissions: ["accounts.fund.release"],
      },
    ];
  }

  if (pathname === "/accounts/manager-ledger/new") {
    return [
      {
        form: "manager-ledger-create-form",
        type: "submit",
        label: "Create Ledger",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/accounts/manager-ledger",
        label: "Cancel",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (pathname === "/accounts/manager-ledger/release") {
    return [
      {
        form: "manager-ledger-release-form",
        type: "submit",
        label: "Save Release",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/accounts/manager-ledger",
        label: "Cancel",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/accounts\/manager-ledger\/[^/]+$/.test(pathname)) {
    return [
      {
        to: "/accounts/manager-ledger",
        label: "Back to List",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (pathname === "/settings/gst-registrations") {
    return [
      {
        to: "/settings/gst-registrations/new",
        label: "Add GST Registration",
        icon: Plus,
        variant: "primary",
      },
    ];
  }

  if (
    pathname === "/settings/gst-registrations/new" ||
    /^\/settings\/gst-registrations\/[^/]+\/edit$/.test(pathname)
  ) {
    return [
      {
        form: "gst-registration-form",
        type: "submit",
        label: "Save GST Registration",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/settings/gst-registrations",
        label: "Cancel",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  if (/^\/settings\/gst-registrations\/[^/]+$/.test(pathname)) {
    const registrationId = pathname.split("/")[3];
    return [
      {
        to: `/settings/gst-registrations/${registrationId}/edit`,
        label: "Edit",
        icon: Plus,
        variant: "primary",
      },
      {
        to: "/settings/gst-registrations",
        label: "Back to List",
        icon: ArrowLeft,
        variant: "secondary",
      },
    ];
  }

  return [];
}

function AppBrand({ collapsed = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
        <CarFront size={20} strokeWidth={2.2} />
      </div>
      <div className={collapsed ? "hidden" : "min-w-0"}>
        <p className="text-xs font-semibold uppercase text-brand-600">
          Ops Hub
        </p>
        <h1 className="text-base font-semibold text-slate-950">
          Booking Admin
        </h1>
      </div>
    </div>
  );
}

function MenuButton({ onClick }) {
  return (
    <button
      type="button"
      aria-label="Open navigation"
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
      onClick={onClick}
    >
      <Menu size={20} strokeWidth={2.2} />
    </button>
  );
}

function isRouteActive(item, pathname) {
  if (item.match?.test(pathname)) return true;
  if (item.aliases?.includes(pathname)) return true;
  if (!item.to) return false;
  if (pathname === item.to) return true;
  if (item.exact) return false;

  return (
    item.to !== "/dashboard" &&
    item.to !== "/settings" &&
    pathname.startsWith(`${item.to}/`)
  );
}

function isGroupActive(item, pathname) {
  return Boolean(
    item.children?.some((child) => isRouteActive(child, pathname)),
  );
}

function findActiveGroupId(pathname) {
  const explicitMatchGroup = navItems.find((item) =>
    item.children?.some((child) => child.match?.test(pathname)),
  );
  if (explicitMatchGroup) return explicitMatchGroup.id;

  return (
    navItems.find((item) => item.children && isGroupActive(item, pathname))
      ?.id || ""
  );
}

function ComingSoonBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
      Coming Soon
    </span>
  );
}

function hasPermission(item, userPermissions) {
  return (
    !item.permissions?.length ||
    item.permissions.some((permission) => userPermissions.has(permission))
  );
}

function visibleNavigation(items, permissions) {
  const userPermissions = new Set(permissions || []);
  return items
    .filter((item) => hasPermission(item, userPermissions))
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) =>
              hasPermission(child, userPermissions),
            ),
          }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);
}

function SidebarNav({ collapsed = false, className = "", onNavigate }) {
  const location = useLocation();
  const { user } = useAuth();
  const permittedNavItems = visibleNavigation(navItems, user?.permissions);
  const [openGroupId, setOpenGroupId] = useState(() =>
    findActiveGroupId(location.pathname),
  );

  useEffect(() => {
    const activeGroupId = findActiveGroupId(location.pathname);
    setOpenGroupId(activeGroupId);
  }, [location.pathname]);

  function toggleGroup(groupId) {
    setOpenGroupId((currentGroupId) =>
      currentGroupId === groupId ? "" : groupId,
    );
  }

  return (
    <nav className={`space-y-1 px-3 py-4 ${className}`}>
      {permittedNavItems.map((item) => {
        const Icon = item.icon;
        const hasChildren = Boolean(item.children?.length);
        const isActive = hasChildren
          ? isGroupActive(item, location.pathname)
          : isRouteActive(item, location.pathname);
        const isOpen = openGroupId === item.id;

        if (hasChildren) {
          return (
            <div key={item.id}>
              <button
                type="button"
                className={`group relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center gap-0" : "gap-3"
                } ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(item.id)}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 ring-1 ring-inset ring-current/10">
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <span className={collapsed ? "sr-only" : "flex-1 text-left"}>
                  {item.label}
                </span>
                {!collapsed && (
                  <ChevronDown
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    size={16}
                    strokeWidth={2.3}
                  />
                )}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                    {item.label}
                  </span>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="ml-10 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const childActive = isRouteActive(child, location.pathname);

                    if (child.disabled) {
                      return (
                        <div
                          key={`${item.id}-${child.label}`}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                            childActive
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-400"
                          }`}
                          aria-disabled="true"
                        >
                          <span>{child.label}</span>
                          {child.badge && <ComingSoonBadge />}
                        </div>
                      );
                    }

                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={onNavigate}
                        className={({ isActive: navLinkActive }) =>
                          `block rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            navLinkActive || childActive
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={item.to || item.id}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center gap-0" : "gap-3"
                } ${
                  isActive || isRouteActive(item, location.pathname)
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`
              }
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 ring-1 ring-inset ring-current/10">
                <Icon size={17} strokeWidth={2.2} />
              </span>
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
              {collapsed && (
                <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                  {item.label}
                </span>
              )}
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}

function MainLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pageTopbarAction, setPageTopbarAction] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const basePath = `/${location.pathname.split("/")[1] || "dashboard"}`;
  const meta =
    getPageMeta(location.pathname) ||
    pageMeta[location.pathname] ||
    pageMeta[basePath] ||
    pageMeta["/dashboard"];
  const requestedTopbarActions = pageTopbarAction
    ? Array.isArray(pageTopbarAction)
      ? pageTopbarAction
      : [pageTopbarAction]
    : getTopbarActions(location.pathname);
  const topbarActions = visibleNavigation(
    requestedTopbarActions,
    user?.permissions,
  );
  const mobileItems = visibleNavigation(bottomNavItems, user?.permissions);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    setPageTopbarAction(null);
  }, [location.pathname]);

  async function handleLogout() {
    setIsProfileOpen(false);
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 print:hidden lg:flex ${
          isSidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <AppBrand collapsed={isSidebarCollapsed} />
          <button
            type="button"
            aria-label={
              isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>

        <SidebarNav
          collapsed={isSidebarCollapsed}
          className="min-h-0 flex-1 overflow-y-auto"
        />

        <div
          className={`mx-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 ${
            isSidebarCollapsed ? "hidden" : ""
          }`}
        >
          <p className="text-xs font-semibold uppercase text-slate-500">
            Workspace
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">Main branch</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live sync active
          </div>
        </div>
      </aside>

      {isMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 print:hidden lg:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <AppBrand />
          <button
            type="button"
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
            onClick={() => setIsMenuOpen(false)}
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
        <SidebarNav
          className="min-h-0 flex-1 overflow-y-auto"
          onNavigate={() => setIsMenuOpen(false)}
        />
      </aside>

      <div
        className={`transition-[padding] duration-200 print:pl-0 ${isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}`}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <MenuButton onClick={() => setIsMenuOpen(true)} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase text-slate-500">
                {meta.eyebrow}
              </p>
              <h2 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
                {meta.title}
              </h2>
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                {meta.description}
              </p>
            </div>

            <label className="hidden min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 xl:flex">
              <Search
                className="mr-2 text-slate-400"
                size={18}
                strokeWidth={2.2}
              />
              <input
                className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Bookings, customers, invoices"
              />
            </label>

            {topbarActions.map((action) => {
              const Icon = action.icon;
              const className = `inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm sm:px-4 ${
                action.variant === "primary"
                  ? "bg-brand-500 text-white hover:bg-brand-600"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`;

              if (action.to) {
                return (
                  <Link
                    key={`${action.label}-${action.to}`}
                    to={action.to}
                    aria-label={action.label}
                    className={className}
                  >
                    <Icon size={17} strokeWidth={2.3} />
                    <span className="hidden sm:inline">{action.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={action.label}
                  type={action.type || "button"}
                  form={action.form}
                  aria-label={action.label}
                  className={className}
                  onClick={action.onClick}
                >
                  <Icon size={17} strokeWidth={2.3} />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              );
            })}

            <div className="relative">
              <button
                type="button"
                aria-expanded={isProfileOpen}
                aria-label="Open user profile menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white"
                onClick={() => setIsProfileOpen((current) => !current)}
              >
                <UserRound size={19} strokeWidth={2.2} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-950">
                      Admin User
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      admin@example.com
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    onClick={handleLogout}
                  >
                    <LogOut size={17} strokeWidth={2.2} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-5 print:p-0 sm:px-6 lg:px-8 lg:pb-8">
          <Outlet context={{ setTopbarAction: setPageTopbarAction }} />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] print:hidden lg:hidden">
        {mobileItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-500"
                }`
              }
            >
              <Icon size={18} strokeWidth={2.2} />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default MainLayout;
