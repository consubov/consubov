import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartStyle } from "./chart";

describe("ChartStyle HTML injection regression", () => {
  it("keeps SVG/script-like color data as text in server rendering", () => {
    const injectedColor = '</style><script data-xss="chart">alert(1)</script><style>';
    const html = renderToStaticMarkup(<ChartStyle id="chart-a" config={{ value: { color: injectedColor } }} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</style><script");
  });

  it("escapes malicious chart IDs and variable keys when rendering the style string", () => {
    const maliciousId = 'a</style><script data-xss="id">alert(1)</script>';
    const maliciousKey = 'v</style><script data-xss="key">alert(1)</script>';
    const html = renderToStaticMarkup(<ChartStyle id={maliciousId} config={{ [maliciousKey]: { color: "#abc" } }} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</style><script");
  });

  it("does not create extra DOM elements from malicious style data", () => {
    const injectedColor = '</style><svg onload="alert(1)"></svg><style>';
    const view = render(<ChartStyle id="chart-b" config={{ value: { color: injectedColor } }} />);
    expect(view.container.querySelector("svg")).toBeNull();
    expect(view.container.querySelectorAll("style")).toHaveLength(1);
    expect(view.container.querySelector("style")?.textContent).toContain(injectedColor);
  });

  it("preserves light and dark CSS variables for valid chart colors", () => {
    const view = render(<ChartStyle id="chart-c" config={{ value: { theme: { light: "#abc123", dark: "#123abc" } } }} />);
    const css = view.container.querySelector("style")?.textContent;
    expect(css).toContain("[data-chart=chart-c] {");
    expect(css).toContain("--color-value: #abc123");
    expect(css).toContain(".dark [data-chart=chart-c] {");
    expect(css).toContain("--color-value: #123abc");
  });

  it("does not add a style tag when no color is configured", () => {
    const view = render(<ChartStyle id="chart-d" config={{ value: { label: "Sem cor" } }} />);
    expect(view.container.querySelector("style")).toBeNull();
  });
});
