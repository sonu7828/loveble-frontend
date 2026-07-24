import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useIdleLogout } from "./useIdleLogout";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("useIdleLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "setInterval");
    vi.spyOn(window, "clearInterval");
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/' },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should trigger logout and redirect exactly once after 15 minutes of inactivity", async () => {
    const { result, unmount } = renderHook(() => useIdleLogout(true));

    // Fast-forward 14 minutes
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });
    
    // Warning should be showing
    expect(result.current.showWarning).toBe(true);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    // Fast-forward 1 more minute (Total 15 minutes)
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
      // Wait for any pending promises in the setInterval
      await Promise.resolve();
    });

    // Should have called signOut
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/staff/login?reason=idle");
    expect(window.clearInterval).toHaveBeenCalled();

    // Fast-forward another minute to ensure interval storm doesn't happen
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
      await Promise.resolve();
    });

    // Still exactly 1 call
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    
    unmount();
  });
});
