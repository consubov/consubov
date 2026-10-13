import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { LandingIcon } from "@/components/landing/LandingIcon";
describe("landing icons without eager full catalog", () => {
  it("renders defaults synchronously with classes and color", () => {
    const { container } = render(<LandingIcon name="Activity" className="w-6 h-6" style={{ color: "green" }} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("lucide-activity", "w-6", "h-6");
    expect(svg).toHaveAttribute("style", "color: green;");
    expect(svg?.querySelector("path")).not.toBeNull();
  });
  it("retains configurable icons outside the default set", async () => {
    const { container } = render(<LandingIcon name="AlarmClock" className="w-4" />);
    await waitFor(() => expect(container.querySelector("svg")).toHaveClass("lucide-alarm-clock", "w-4"));
  });
  it.each([undefined, "", "not-a-real-icon", "constructor", "__proto__"])("has visible fallback for %s", async (name) => {
    const { container } = render(<LandingIcon name={name} />);
    await waitFor(() => expect(container.querySelector("svg")).toHaveClass("lucide-sparkles"));
  });
});
