import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../auth/ProtectedRoute";
import PermissionRoute from "../auth/PermissionRoute";
import MainLayout from "../layouts/MainLayout";
import PlatformLayout from "../layouts/PlatformLayout";
import AccessDeniedPage from "../pages/Access/AccessDenied";
import PermissionsPage from "../pages/Access/Permissions";
import RolesPage from "../pages/Access/Roles";
import UsersPage from "../pages/Access/Users";
import BookingCashDepositPage from "../pages/Accounts/BookingCashDeposit";
import DailyClosingPage from "../pages/Accounts/DailyClosing";
import ManagerLedgerPage from "../pages/Accounts/ManagerLedger";
import ManagerLedgerDetailPage from "../pages/Accounts/ManagerLedgerDetail";
import ManagerLedgerCreatePage from "../pages/Accounts/ManagerLedgerCreate";
import ManagerLedgerFormPage from "../pages/Accounts/ManagerLedgerForm";
import AuditVerificationPage from "../pages/Accounts/Reconciliation";
import TransactionsPage from "../pages/Accounts/Transactions";
import AccountsOverviewPage from "../pages/Accounts/Overview";
import AccountsCollectionsPage from "../pages/Accounts/Collections";
import BookingsPage from "../pages/Bookings";
import CloseBookingPage from "../pages/Bookings/Close";
import BookingCollectionPage from "../pages/Bookings/Collection";
import BookingFormPage from "../pages/Bookings/Form";
import BookingProfitPage from "../pages/Bookings/Profit";
import BookingViewPage from "../pages/Bookings/View";
import DutySlipPage from "../pages/Bookings/DutySlip";
import CustomerCreatePage from "../pages/Customers/Create";
import CustomerDetailPage from "../pages/Customers/Detail";
import CustomerEditPage from "../pages/Customers/Edit";
import CustomersPage from "../pages/Customers";
import DashboardPage from "../pages/Dashboard";
import InvoiceFormPage from "../pages/Invoices/Form";
import InvoicesPage from "../pages/Invoices";
import InvoicePreviewPage from "../pages/Invoices/Preview";
import InvoicePrintPage from "../pages/Invoices/Print";
import LoginPage from "../pages/Login";
import PlatformAuditLogsPage from "../pages/Platform/AuditLogs";
import PlatformDashboardPage from "../pages/Platform/Dashboard";
import PlatformPaymentsPage from "../pages/Platform/Payments";
import PlatformPlansPage from "../pages/Platform/Plans";
import PlatformSubscriptionsPage from "../pages/Platform/Subscriptions";
import PlatformTenantsPage from "../pages/Platform/Tenants";
import PlatformUsersPage from "../pages/Platform/Users";
import ReportsPage from "../pages/Reports";
import SettingsPage from "../pages/Settings";
import GSTRegistrationsPage from "../pages/Settings/GSTRegistrations";
import VendorsPage from "../pages/Vendors";
import VehiclesPage from "../pages/Vehicles";
import DriversPage from "../pages/Drivers";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute userType="PLATFORM" />}>
        <Route element={<PlatformLayout />}>
          <Route
            path="/platform"
            element={<Navigate to="/platform/dashboard" replace />}
          />
          <Route
            path="/platform/dashboard"
            element={<PlatformDashboardPage />}
          />
          <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
          <Route
            path="/platform/tenants/new"
            element={<PlatformTenantsPage />}
          />
          <Route
            path="/platform/subscription-plans"
            element={<PlatformPlansPage />}
          />
          <Route
            path="/platform/plans"
            element={<Navigate to="/platform/subscription-plans" replace />}
          />
          <Route
            path="/platform/subscriptions"
            element={<PlatformSubscriptionsPage />}
          />
          <Route path="/platform/payments" element={<PlatformPaymentsPage />} />
          <Route
            path="/platform/billing"
            element={<Navigate to="/platform/payments" replace />}
          />
          <Route path="/platform/users" element={<PlatformUsersPage />} />
          <Route
            path="/platform/audit-logs"
            element={<PlatformAuditLogsPage />}
          />
        </Route>
      </Route>
      <Route element={<ProtectedRoute userType="TENANT" />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/bookings/new" element={<BookingFormPage />} />
          <Route path="/bookings/:id" element={<BookingViewPage />} />
          <Route path="/bookings/:id/duty-slip" element={<DutySlipPage />} />
          <Route path="/bookings/:id/edit" element={<BookingFormPage />} />
          <Route path="/bookings/:id/close" element={<CloseBookingPage />} />
          <Route
            path="/bookings/:id/collections"
            element={<BookingCollectionPage />}
          />
          <Route path="/bookings/:id/profit" element={<BookingProfitPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/new" element={<CustomerCreatePage />} />
          <Route
            path="/customers/:customerId"
            element={<CustomerDetailPage />}
          />
          <Route
            path="/customers/:customerId/edit"
            element={<CustomerEditPage />}
          />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/new" element={<InvoiceFormPage />} />
          <Route
            path="/invoices/create"
            element={<Navigate to="/invoices/new" replace />}
          />
          <Route
            path="/invoices/:invoiceId/edit"
            element={<InvoiceFormPage />}
          />
          <Route
            path="/invoices/:invoiceId/preview"
            element={<InvoicePreviewPage />}
          />
          <Route
            path="/invoices/:invoiceId/print"
            element={<InvoicePrintPage />}
          />
          <Route
            path="/invoices/settings"
            element={<Navigate to="/settings" replace />}
          />
          <Route
            path="/accounts"
            element={
              <PermissionRoute
                anyOf={[
                  "accounts.collection.view",
                  "accounts.deposit.manage",
                  "accounts.ledger.view",
                  "accounts.fund.release",
                  "accounts.expense.manage",
                  "accounts.daily_closing.manage",
                  "accounts.audit.verify",
                ]}
              >
                <AccountsOverviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/collections"
            element={
              <PermissionRoute anyOf={["accounts.collection.view"]}>
                <AccountsCollectionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/manager-ledger"
            element={
              <PermissionRoute anyOf={["accounts.ledger.view"]}>
                <ManagerLedgerPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/manager-ledger/new"
            element={
              <PermissionRoute anyOf={["accounts.fund.release"]}>
                <ManagerLedgerCreatePage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/manager-ledger/release"
            element={
              <PermissionRoute anyOf={["accounts.fund.release"]}>
                <ManagerLedgerFormPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/manager-ledger/:ledgerId"
            element={
              <PermissionRoute anyOf={["accounts.ledger.view"]}>
                <ManagerLedgerDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/transactions"
            element={
              <PermissionRoute anyOf={["accounts.expense.manage"]}>
                <TransactionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/expense-entry"
            element={<Navigate to="/accounts/transactions" replace />}
          />
          <Route
            path="/accounts/booking-cash-deposit"
            element={
              <PermissionRoute anyOf={["accounts.deposit.manage"]}>
                <BookingCashDepositPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/daily-closing"
            element={
              <PermissionRoute anyOf={["accounts.daily_closing.manage"]}>
                <DailyClosingPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/audit-verification"
            element={
              <PermissionRoute anyOf={["accounts.audit.verify"]}>
                <AuditVerificationPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/accounts/reconciliation"
            element={<Navigate to="/accounts/audit-verification" replace />}
          />
          <Route
            path="/expenses"
            element={<Navigate to="/accounts/transactions" replace />}
          />
          <Route
            path="/reports"
            element={
              <PermissionRoute anyOf={["reports.view"]}>
                <ReportsPage />
              </PermissionRoute>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/settings/gst-registrations"
            element={<GSTRegistrationsPage />}
          />
          <Route
            path="/settings/gst-registrations/new"
            element={<GSTRegistrationsPage />}
          />
          <Route
            path="/settings/gst-registrations/:registrationId"
            element={<GSTRegistrationsPage />}
          />
          <Route
            path="/settings/gst-registrations/:registrationId/edit"
            element={<GSTRegistrationsPage />}
          />
          <Route path="/settings/users" element={<UsersPage />} />
          <Route path="/settings/roles" element={<RolesPage />} />
          <Route path="/settings/permissions" element={<PermissionsPage />} />
          <Route
            path="/settings/users-roles"
            element={<Navigate to="/settings/users" replace />}
          />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
