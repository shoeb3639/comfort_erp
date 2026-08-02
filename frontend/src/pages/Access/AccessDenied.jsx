import { Link, useLocation } from "react-router-dom";

function AccessDeniedPage() {
  const location = useLocation();
  const requiredPermissions = location.state?.requiredPermissions || [];

  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">
        Access Denied
      </p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">
        You do not have permission to view this page.
      </h3>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Access is controlled by your tenant role permissions. Ask a tenant
        administrator to update your role if this workspace is required.
      </p>
      {requiredPermissions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {requiredPermissions.map((permission) => (
            <code
              key={permission}
              className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              {permission}
            </code>
          ))}
        </div>
      )}
      <Link
        className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        to="/dashboard"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export default AccessDeniedPage;
