/** Synthetic UI-only rows. Never use this module as a backend or seed a real database. */
export type FixtureRow = Record<string, unknown>;
export type FixtureRows = Record<string, FixtureRow[]>;

export function fieldFixtures(now = new Date()): FixtureRows {
  const farm = { id: "fazenda-1", nome: "Fazenda de teste", ativo: true };
  return {
    fazendas: [farm],
    retiros: [
      { id: "retiro-1", nome: "Retiro de teste", fazenda_id: farm.id, produto_id: "produto-1", ativo: true },
      { id: "retiro-2", nome: "Retiro de destino", fazenda_id: farm.id, produto_id: null, ativo: true },
    ],
    capatazes_retiros: [{ capataz_id: "role-1", retiro_id: "retiro-1", principal: true, retiros: { nome: "Retiro de teste" } }],
    gerentes_fazendas: [{ gerente_id: "role-1", fazenda_id: farm.id, fazendas: farm }],
    produtos_fazendas: [{ produto_id: "produto-1", fazenda_id: farm.id }],
    produtos: [{
      id: "produto-1", nome: "Produto de teste", marca: "Marca de teste", ativo: true,
      peso_saco_kg: 30, consumo_recria1: null, consumo_recria2: null, consumo_engorda: null,
      margem_recria1: null, margem_recria2: null, margem_engorda: null, preco_por_kg: null,
    }],
    pastos: [{
      id: "pasto-1", qr_uuid: "22222222-2222-4222-8222-222222222222", nome: "Pasto de teste",
      retiro_id: "retiro-1", ativo: true, num_animais: 10, peso_medio_kg: 200,
      dias_no_pasto: 10, sexo: "Macho", categoria: "Recria 1", produto_id: "produto-1",
    }],
    ciclos: [{ id: "ciclo-1", fazenda_id: farm.id, mes: now.getMonth() + 1, ano: now.getFullYear(), fechado: false }],
    fabricas: [{ id: "fabrica-1", codigo: "TEST", nome: "Fabrica de teste", descricao: null }],
  };
}

/** Only the read filters used by these fixtures. Unsupported filters fail instead of inventing rows. */
export function selectFixtureRows(rows: FixtureRow[], query: URLSearchParams): FixtureRow[] {
  if (rows.length === 0) return [];
  let selected = [...rows];
  const presentation = new Set(["select", "order", "limit", "offset"]);
  for (const [key, expression] of query) {
    if (presentation.has(key)) continue;
    const negative = expression.startsWith("not.");
    const filter = negative ? expression.slice(4) : expression;
    const dot = filter.indexOf(".");
    const op = filter.slice(0, dot);
    const raw = filter.slice(dot + 1);
    if (!["eq", "neq", "is", "in", "ilike", "gt", "gte", "lt", "lte"].includes(op)) {
      throw new Error(`Unsupported local fixture filter: ${key}=${expression}`);
    }
    selected = selected.filter(row => {
      const value = row[key];
      let matches: boolean;
      if (op === "is") matches = raw === "null" ? value == null : String(value) === raw;
      else if (op === "eq") matches = String(value) === raw;
      else if (op === "neq") matches = String(value) !== raw;
      else if (op === "in") matches = raw.replace(/^\(|\)$/g, "").split(",").includes(String(value));
      else if (op === "ilike") {
        const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
        matches = new RegExp(`^${escaped}$`, "i").test(String(value ?? ""));
      } else {
        const a = typeof value === "number" ? value : String(value ?? "");
        const b = typeof value === "number" ? Number(raw) : raw;
        matches = op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
      }
      return negative ? !matches : matches;
    });
  }
  return structuredClone(selected);
}

/** A valid, empty one-page PDF generated entirely in the test process. */
export function localPdfFixture(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
