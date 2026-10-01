import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { fetchLandingContent } from "./landingContentRepository";

describe("landingContentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({
      select: mocks.select,
    });

    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });
  });

  test("loads and maps landing content without exposing Supabase to the hook", async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { chave: "hero_title", valor: "Consubov" },
        { chave: "hero_subtitle", valor: null },
      ],
      error: null,
    });

    await expect(fetchLandingContent("consubov")).resolves.toEqual({
      hero_title: "Consubov",
      hero_subtitle: "",
    });

    expect(mocks.from).toHaveBeenCalledWith("landing_page_content");
    expect(mocks.select).toHaveBeenCalledWith("chave, valor");
    expect(mocks.eq).toHaveBeenCalledWith("landing_slug", "consubov");
  });

  test("preserves the previous empty-data behavior", async () => {
    mocks.eq.mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    await expect(fetchLandingContent("relatto")).resolves.toEqual({});
  });
});
