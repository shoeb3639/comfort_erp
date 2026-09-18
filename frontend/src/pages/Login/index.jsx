import { useState } from "react";
import { CarFront, Eye, EyeOff } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getAuthErrorMessage } from "../../services/auth";
import { APP_NAME } from "../../config/app";

function LoginPage() {
  const { isAuthenticated, isInitializing, signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isInitializing && isAuthenticated) {
    return (
      <Navigate
        to={user.userType === "PLATFORM" ? "/platform/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await signIn({ email, password });
      const requestedPath = location.state?.from?.pathname;
      const permittedRequestedPath =
        session.user.userType === "PLATFORM"
          ? requestedPath?.startsWith("/platform")
          : requestedPath && !requestedPath.startsWith("/platform");
      navigate(
        permittedRequestedPath
          ? requestedPath
          : session.user.userType === "PLATFORM"
            ? "/platform/dashboard"
            : "/dashboard",
        {
          replace: true,
        },
      );
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-4 sm:p-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md shadow-brand-200">
            <CarFront size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
              {APP_NAME}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">
            Sign in to {APP_NAME}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-5 text-slate-500">
          Manage bookings, billing, reports, and more from one place.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 px-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <span className="relative mt-1 block">
              <input
                className="h-12 w-full rounded-xl border border-slate-200 py-2 pl-3 pr-11 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:text-sm"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
          {error && (
            <p
              className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-brand-500 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
