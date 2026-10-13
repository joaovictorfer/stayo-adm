import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  effect: undefined as undefined | (() => void | (() => void)),
  listener: undefined as undefined | ((event: string, session: unknown) => void),
  getSession: vi.fn(),
  getProfile: vi.fn(),
  setState: vi.fn(),
  clear: vi.fn(),
  cancelQueries: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [{}, harness.setState],
  useEffect: (effect: () => void | (() => void)) => { harness.effect = effect; },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: harness.clear, cancelQueries: harness.cancelQueries }),
}));
vi.mock("../api/supabase-client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: harness.getSession,
      onAuthStateChange: (listener: typeof harness.listener) => {
        harness.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: harness.getProfile }) }) }),
  }),
}));
import { AuthSessionProvider } from "./session";

const session = { access_token: "test-token", user: { id: "test-user" } };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe("shared session loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.getSession.mockResolvedValue({ data: { session } });
    harness.getProfile.mockResolvedValue({ data: { id: "test-user", full_name: "Test", role: "viewer", active: true } });
  });
  it("reads the profile once when initial session and auth notification overlap", async () => {
    AuthSessionProvider({ children: null });
    const cleanup = harness.effect?.();
    harness.listener?.("INITIAL_SESSION", session);
    await flush();
    expect(harness.getProfile).toHaveBeenCalledTimes(1);
    expect(harness.setState).toHaveBeenLastCalledWith(expect.objectContaining({ status: "authenticated" }));
    if (typeof cleanup === "function") cleanup();
  });
  it("clears cached reads on sign-out and ignores a late profile response", async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    harness.getProfile.mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
    AuthSessionProvider({ children: null });
    const cleanup = harness.effect?.();
    await flush();
    harness.listener?.("SIGNED_OUT", null);
    await flush();
    resolveProfile?.({ data: null });
    await flush();
    expect(harness.cancelQueries).toHaveBeenCalledTimes(1);
    expect(harness.clear).toHaveBeenCalledTimes(1);
    expect(harness.setState).toHaveBeenLastCalledWith({ status: "unauthenticated", session: null, profile: null });
    if (typeof cleanup === "function") cleanup();
  });
});