import React from "react";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useIdleLogout } from "./useIdleLogout";
import { authService } from "@/services/api/authService";

vi.mock("@/services/api/authService", () => ({
  authService: {
    logout: vi.fn().mockResolvedValue({ success: true }),
    getSession: vi.fn().mockResolvedValue({ session: { user: { id: "1" } }, user: { id: "1" } }),
  },
}));

describe("useIdleLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "setInterval");
    vi.spyOn(window, "clearInterval");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(MemoryRouter, null, children)
  );

  it("should trigger warning at 14 minutes and logout at 15 minutes", async () => {
    const { result, unmount } = renderHook(() => useIdleLogout(true), { wrapper });

    // Fast-forward 14 minutes (840s)
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    // Warning should be visible
    expect(result.current.showWarning).toBe(true);

    // Fast-forward 60 seconds (total 15 minutes)
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
      await Promise.resolve();
    });

    // Should have called logout
    expect(authService.logout).toHaveBeenCalledTimes(1);

    unmount();
  });
});
