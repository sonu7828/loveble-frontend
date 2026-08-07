/**
 * Radiantilyk EMR — useAuth Hook
 * Phase 1B: Shared Auth Context Consumer.
 *
 * Consumes the centralized AuthContext provider.
 * All components using useAuth() share the exact same React in-memory state.
 * NO localStorage / sessionStorage used for user, roles, tokens, or sessions.
 */

import { useAuthContext, AuthContextType, AppRole, resolveLandingRoute } from "@/context/AuthContext";

export type { AppRole, AuthContextType as AuthState };
export { resolveLandingRoute };

export function useAuth(): AuthContextType {
  return useAuthContext();
}
