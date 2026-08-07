/**
 * Radiantilyk EMR — Auth Route Utilities
 *
 * Extracted from AuthContext so that AuthContext.tsx can export ONLY
 * React components, satisfying Vite/React Fast Refresh HMR constraints.
 * (A file cannot mix component exports and non-component exports without
 * breaking HMR — see: vite-plugin-react-swc consistent-components-exports)
 */

import type { AppRole } from "@/services/api/authService";

/**
 * Resolve the correct landing route for a given set of roles.
 * Always returns an absolute path string.
 */
export function resolveLandingRoute(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/admin/hub";
  if (roles.includes("privacy_officer")) return "/staff/security-officer";
  if (
    roles.includes("nurse_practitioner") ||
    roles.includes("medical_director") ||
    roles.includes("rn_injector") ||
    roles.includes("front_desk")
  ) {
    return "/staff/today";
  }
  if (roles.includes("patient")) return "/account";
  return "/staff/today";
}
