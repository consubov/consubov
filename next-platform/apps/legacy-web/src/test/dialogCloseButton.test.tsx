import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

describe("dialog close control composition", () => {
  it("preserves the default close control for existing consumers", () => {
    const changed = vi.fn();
    render(<Dialog open onOpenChange={changed}><DialogContent><DialogTitle>Default</DialogTitle><DialogDescription>Example</DialogDescription></DialogContent></Dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(changed).toHaveBeenCalledWith(false);
  });
  it("lets a custom toolbar close button replace the overlapping default", () => {
    const changed = vi.fn();
    render(<Dialog open onOpenChange={changed}><DialogContent showCloseButton={false}><DialogTitle>Custom</DialogTitle><DialogDescription>Example</DialogDescription><DialogClose asChild><button>Fechar</button></DialogClose></DialogContent></Dialog>);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith(false);
  });
});
