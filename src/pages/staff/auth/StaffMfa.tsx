import { Navigate } from "react-router-dom";

// MFA flow is now unified into /staff/login (step state). This route stays
// for backward-compatible deep links and bounces to the canonical entry point.
export default function StaffMfa() {
  return <Navigate to="/staff/login" replace />;
}
