import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function PermissionRoute({ anyOf = [], allOf = [], children }) {
  const { user } = useAuth();
  const location = useLocation();
  const permissions = new Set(user?.permissions || []);
  const hasAny = anyOf.length === 0 || anyOf.some((key) => permissions.has(key));
  const hasAll = allOf.every((key) => permissions.has(key));

  if (!hasAny || !hasAll) {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{ from: location, requiredPermissions: [...anyOf, ...allOf] }}
      />
    );
  }

  return children;
}
