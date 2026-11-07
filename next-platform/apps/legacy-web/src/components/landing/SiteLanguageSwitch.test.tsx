import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteLanguageSwitch } from "./SiteLanguageSwitch";
import type { SiteLanguage } from "@/lib/siteLanguage";

function Harness() {
  const [language, setLanguage] = useState<SiteLanguage>("pt-BR");
  return <SiteLanguageSwitch language={language} onChange={setLanguage} />;
}

describe("SiteLanguageSwitch", () => {
  it("shows both flags as real SVG icons, independent of emoji fonts", () => {
    const onChange = vi.fn();
    const { container } = render(<SiteLanguageSwitch language="pt-BR" onChange={onChange} />);
    expect(screen.getByTestId("site-flag-br").tagName.toLowerCase()).toBe("svg");
    expect(screen.getByTestId("site-flag-us").tagName.toLowerCase()).toBe("svg");
    expect(container.textContent).not.toContain("🇧🇷");
    expect(container.textContent).not.toContain("🇺🇸");
    expect(screen.getByRole("button", { name: "Português (Brasil)" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("switches languages and preserves accessible labels", () => {
    render(<Harness />);
    const english = screen.getByRole("button", { name: "English (United States)" });
    fireEvent.click(english);
    expect(english.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Português (Brasil)" }).getAttribute("aria-pressed")).toBe("false");
  });
});
