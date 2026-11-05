import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppLanguageProvider, useTranslation } from "@/hooks/useTranslation";
import { AppLanguageSwitch } from "@/components/AppLanguageSwitch";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { APP_TRANSLATIONS } from "@/lib/translations";

function Probe() {
  const { language, t } = useTranslation();
  return <><span data-testid="locale">{language}</span><span data-testid="copy">{t("auth.login")}</span><span data-testid="ranches">{t("nav.farms")}</span><span data-testid="manager">{t("role.manager")}</span></>;
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
    expect(screen.getByTestId("ranches")).toHaveTextContent("Fazendas");
    expect(screen.getByTestId("manager")).toHaveTextContent("Gerente");
    expect(screen.getByTestId("app-language-switch")).toHaveClass("top-0");
    expect(screen.getByTestId("app-language-switch")).not.toHaveClass("bottom-20");
    fireEvent.click(screen.getByRole("button", { name: "English (United States)" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(document.documentElement.lang).toBe("en-US");
    expect(screen.getByTestId("copy")).toHaveTextContent("Sign in");
    expect(screen.getByTestId("ranches")).toHaveTextContent("Ranches");
    expect(screen.getByTestId("manager")).toHaveTextContent("Manager");
    expect(localStorage.getItem("consubov:site-language")).toBe("pt-BR");
    expect(localStorage.getItem("consubov:app-language")).toBe("en-US");
    fireEvent.click(screen.getByRole("button", { name: "Português (Brasil)" }));
    expect(screen.getByTestId("ranches")).toHaveTextContent("Fazendas");
    expect(localStorage.getItem("consubov:app-language")).toBe("pt-BR");
  });
  it("renders site-style flags before the version in operational layouts", () => {
    localStorage.setItem("consubov:app-language", "pt-BR");
    render(<MemoryRouter initialEntries={["/admin"]}><AppLanguageProvider><AppLanguageSwitch /><AppVersionBadge /><Probe /></AppLanguageProvider></MemoryRouter>);
    expect(screen.queryByTestId("app-language-switch")).toBeNull();
    const group = screen.getByTestId("app-language-version");
    expect(group.querySelector("[data-testid=site-flag-br]")).not.toBeNull();
    expect(group.querySelector("[data-testid=site-flag-us]")).not.toBeNull();
    expect(group.firstElementChild).toHaveAttribute("role", "group");
    expect(group.lastElementChild).toHaveAttribute("aria-label", expect.stringContaining("Versão do app"));
    fireEvent.click(screen.getByRole("button", { name: "English (United States)" }));
    expect(screen.getByTestId("ranches")).toHaveTextContent("Ranches");
    expect(screen.getByRole("button", { name: "English (United States)" })).toHaveAttribute("aria-pressed", "true");
  });
  it("leaves operational values untouched for missing keys", () => {
    function DynamicProbe() { const { t } = useTranslation(); return <span>{t("Fazenda Águas Claras")}</span>; }
    render(<MemoryRouter><AppLanguageProvider><DynamicProbe /></AppLanguageProvider></MemoryRouter>);
    expect(screen.getByText("Fazenda Águas Claras")).toBeInTheDocument();
  });
  it("hides its controls on public pages", () => {
    render(<MemoryRouter initialEntries={["/"]}><AppLanguageProvider><AppLanguageSwitch /></AppLanguageProvider></MemoryRouter>);
    expect(screen.queryByTestId("app-language-switch")).toBeNull();
  });
});
