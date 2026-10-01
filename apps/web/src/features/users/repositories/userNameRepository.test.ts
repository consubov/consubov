import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  findUserDisplayName,
  normalizeUserDisplayName,
} from "./userNameRepository";

describe("userNameRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({
      select: mocks.select,
    });
    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });
    mocks.eq.mockReturnValue({
      maybeSingle: mocks.maybeSingle,
    });
  });

  test("returns the first valid name following the requested table order", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { nome: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { nome: "Maria da Silva" },
        error: null,
      });

    await expect(
      findUserDisplayName("user-1", ["capatazes", "gerentes"]),
    ).resolves.toBe("Maria da Silva");

    expect(mocks.from).toHaveBeenNthCalledWith(1, "capatazes");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "gerentes");
    expect(mocks.select).toHaveBeenCalledWith("nome");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  test("skips email-shaped names and keeps looking", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { nome: "user@example.com" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { nome: "João" },
        error: null,
      });

    await expect(
      findUserDisplayName("user-2", ["administradores", "gerentes"]),
    ).resolves.toBe("João");
  });

  test("returns null when no role table provides a valid name", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      findUserDisplayName("user-3", ["operadores_fabrica"]),
    ).resolves.toBeNull();
  });

  test("normalizes metadata names using the same no-email rule", () => {
    expect(normalizeUserDisplayName("Ana")).toBe("Ana");
    expect(normalizeUserDisplayName("ana@example.com")).toBeNull();
    expect(normalizeUserDisplayName(null)).toBeNull();
  });
});
