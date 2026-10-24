import { describe, expect, it } from "vitest";
import { z as z3 } from "zod/v3";
import { z as z4 } from "zod";
import { clienteSchema, leadSchema } from "@/lib/zodSchemas";

// Baselines Zod 3: espelham os schemas do app anteriores ao upgrade.
const oldLead = z3.object({
  nome: z3.string().trim().min(2, "Nome obrigatório").max(100),
  email: z3.string().trim().email("E-mail inválido").max(255),
  telefone: z3.string().trim().min(10, "Telefone inválido").max(20),
  whatsapp: z3.string().trim().min(10, "WhatsApp inválido").max(20),
  mensagem: z3.string().trim().max(1000).optional(),
});

const oldCliente = z3.object({
  nome: z3.string().trim().min(1, "Nome obrigatório").max(120),
  nome_fazenda: z3.string().trim().max(120).optional().or(z3.literal("")),
  cidade: z3.string().trim().max(80).optional().or(z3.literal("")),
  telefone: z3.string().trim().max(30).optional().or(z3.literal("")),
});

const validLead = {
  nome: " Ana Silva ",
  email: " ana@example.com ",
  telefone: " 62999999999 ",
  whatsapp: " 62999999999 ",
};

function expectSameOutcome(
  oldResult: ReturnType<typeof oldLead.safeParse> | ReturnType<typeof oldCliente.safeParse>,
  newResult: ReturnType<typeof leadSchema.safeParse> | ReturnType<typeof clienteSchema.safeParse>,
) {
  expect(newResult.success).toBe(oldResult.success);
  if (newResult.success && oldResult.success) {
    expect(newResult.data).toEqual(oldResult.data);
  } else if (!newResult.success && !oldResult.success) {
    // Default Zod error wording is version-specific; UI contract uses paths
    // and explicit Portuguese messages for required/format fields.
    expect(newResult.error.issues.map((issue) => issue.path.join(".")))
      .toEqual(oldResult.error.issues.map((issue) => issue.path.join(".")));
  }
}

describe("Zod 3 to Zod 4: Consubov lead input parity", () => {
  it.each([
    ["valid and trimmed", validLead],
    ["optional message", { ...validLead, mensagem: " Observacao " }],
    ["extra property ignored", { ...validLead, desconhecido: "ignorar" }],
    ["name too short", { ...validLead, nome: " " }],
    ["invalid email", { ...validLead, email: "invalido" }],
    ["short phone", { ...validLead, telefone: "123" }],
    ["short WhatsApp", { ...validLead, whatsapp: "123" }],
    ["overlong name", { ...validLead, nome: "x".repeat(101) }],
    ["overlong message", { ...validLead, mensagem: "x".repeat(1001) }],
    ["non-string email", { ...validLead, email: 42 }],
  ])("preserves %s", (_case, payload) => {
    expectSameOutcome(oldLead.safeParse(payload), leadSchema.safeParse(payload));
  });

  it.each([
    ["nome", { ...validLead, nome: " " }, "Nome obrigatório"],
    ["email", { ...validLead, email: "invalido" }, "E-mail inválido"],
    ["telefone", { ...validLead, telefone: "123" }, "Telefone inválido"],
    ["whatsapp", { ...validLead, whatsapp: "123" }, "WhatsApp inválido"],
  ])("retains explicit %s field message", (field, payload, message) => {
    const result = leadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((issue) => issue.path[0] === field)?.message)
        .toBe(message);
    }
  });
});

describe("Zod 3 to Zod 4: Pesador client input parity", () => {
  it.each([
    ["only required name", { nome: " Fazenda Teste " }],
    ["empty optional fields", { nome: "Teste", nome_fazenda: "", cidade: "", telefone: "" }],
    ["trim optional fields", { nome: "Teste", nome_fazenda: " Fazenda ", cidade: " Palmas ", telefone: " 123 " }],
    ["name empty", { nome: "  " }],
    ["name too long", { nome: "x".repeat(121) }],
    ["farm too long", { nome: "Teste", nome_fazenda: "x".repeat(121) }],
    ["city too long", { nome: "Teste", cidade: "x".repeat(81) }],
    ["phone too long", { nome: "Teste", telefone: "x".repeat(31) }],
    ["non-string name", { nome: 7 }],
    ["extra property ignored", { nome: "Teste", outro: 2 }],
  ])("preserves %s", (_case, payload) => {
    expectSameOutcome(oldCliente.safeParse(payload), clienteSchema.safeParse(payload));
  });

  it("retains required-name message on blank input", () => {
    const result = clienteSchema.safeParse({ nome: " " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["nome"]);
      expect(result.error.issues[0]?.message).toBe("Nome obrigatório");
    }
  });
});

describe("Zod 4 bounded collection regression", () => {
  it("rejects a small oversized synthetic array at the size boundary", () => {
    const bounded = z4.array(z4.string()).max(2);
    expect(bounded.safeParse(["a", "b"]).success).toBe(true);
    const invalid = bounded.safeParse(["a", "b", "c"]);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0]?.code).toBe("too_big");
  });
});
