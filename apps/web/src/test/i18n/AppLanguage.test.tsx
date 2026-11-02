import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppLanguageProvider, useTranslation } from "@/hooks/useTranslation";
import { AppLanguageSwitch } from "@/components/AppLanguageSwitch";
import { APP_TRANSLATIONS } from "@/lib/translations";

function Probe() {
  const { language, t } = useTranslation();
  return <><span data-testid="locale">{language}</span><span data-testid="copy">{t("auth.login")}</span></>;
}
afterEach(() => localStorage.removeItem("consubov:app-language"));
describe("App language preference", () => {
  it("has matching nonempty keys", () => {
    expect(Object.keys(APP_TRANSLATIONS["pt-BR"]).sort()).toEqual(Object.keys(APP_TRANSLATIONS["en-US"]).sort());
    for (const translation of Object.values(APP_TRANSLATIONS)) for (const value of Object.values(translation)) expect(value.trim()).not.toBe("");
  });
  it("switches without altering the website language", () => {
    localStorage.setItem("consubov:app-language", "pt-BR");
    localStorage.setItem("consubov:site-language", "pt-BR");
    render(<MemoryRouter initialEntries={["/login"]}><AppLanguageProvider><Probe /><AppLanguageSwitch /></AppLanguageProvider></MemoryRouter>);
    expect(screen.getByTestId("app-language-switch")).toHaveAttribute("aria-label", "Idioma / Language");
    expect(screen.getByTestId("app-language-switch").tagName).toBe("ASIDE");
    expect(screen.getByTestId("copy")).toHaveTextContent("Entrar");
    fireEvent.change(screen.getByRole("combobox", { name: "Idioma / Language" }), { target: { value: "en-US" } });
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(document.documentElement.lang).toBe("en-US");
    expect(screen.getByTestId("copy")).toHaveTextContent("Sign in");
    expect(localStorage.getItem("consubov:site-language")).toBe("pt-BR");
    expect(localStorage.getItem("consubov:app-language")).toBe("en-US");
  });
  it("hides its controls on public pages", () => {
    render(<MemoryRouter initialEntries={["/"]}><AppLanguageProvider><AppLanguageSwitch /></AppLanguageProvider></MemoryRouter>);
    expect(screen.queryByTestId("app-language-switch")).toBeNull();
  });
});
