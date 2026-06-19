export interface StatusDist {
  baixo: number;
  ideal: number;
  alto: number;
  baixoPct: number;
  idealPct: number;
  altoPct: number;
}

export interface PainelProdutoSource {
  id: string;
  peso_saco_kg: number;
  preco_por_kg: number | null;
}

export interface PainelRetiroSource {
  id: string;
  produto_id: string | null;
}

export interface PainelPastoSource {
  id: string;
  retiro_id: string;
  num_animais: number;
  gmd_kg_dia: number | null;
  produto_id: string | null;
}

export interface PainelLancamentoSource {
  pasto_id: string;
  retiro_id: string;
  num_sacos: number;
  num_animais: number;
  dias_no_pasto: number;
  consumo_g_cab_dia: number | null;
  status_consumo: string | null;
  indice_consumo: number | null;
  created_at?: string | null;
  mes_referencia?: number | null;
  ano_referencia?: number | null;
}

export interface PainelMetricsAggregate {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  pastosNaMeta: number;
  totalPastos: number;
  custoDiario: number;
  custoMensal: number;
  eficiencia: number;
  gmdMedio: number;
  totalSalgas: number;
  statusDist: StatusDist;
  totalKgConsumido: number;
  totalCabDias: number;
  totalCusto: number;
}

export interface RetiroMetricsAggregate {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  gmd: number;
  totalKgConsumido: number;
  totalCabDias: number;
  totalCusto: number;
}

interface DerivedLancamentoData {
  cabDias: number;
  totalKgConsumido: number;
  totalCusto: number;
}

const toNumber = (value: number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPositiveNumber = (value: number | null | undefined) => {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : 0;
};

const sumValues = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

const buildById = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));

const getCabDias = (item: PainelLancamentoSource) => {
  const numAnimais = toPositiveNumber(item.num_animais);
  const dias = toPositiveNumber(item.dias_no_pasto);
  return numAnimais > 0 && dias > 0 ? numAnimais * dias : 0;
};

const getPastosComLancamento = <T extends PainelPastoSource>(pastos: T[], lancamentos: PainelLancamentoSource[]) => {
  const pastoIdsComLancamento = new Set(lancamentos.map((item) => item.pasto_id));
  return pastos.filter((pasto) => pastoIdsComLancamento.has(pasto.id));
};

const getTotalAnimais = <T extends PainelPastoSource>(pastos: T[], lancamentos: PainelLancamentoSource[]) => {
  if (lancamentos.length === 0) {
    return sumValues(pastos.map((pasto) => toNumber(pasto.num_animais)));
  }

  const animaisPorPasto = new Map<string, number>();
  for (const item of lancamentos) {
    const atual = animaisPorPasto.get(item.pasto_id) ?? 0;
    if (item.num_animais > atual) {
      animaisPorPasto.set(item.pasto_id, item.num_animais);
    }
  }

  return sumValues(Array.from(animaisPorPasto.values()));
};

const getGmdMedio = <T extends PainelPastoSource>(pastos: T[]) => {
  const valores = pastos.map((pasto) => toPositiveNumber(pasto.gmd_kg_dia)).filter((value) => value > 0);
  return valores.length > 0 ? sumValues(valores) / valores.length : 0;
};

const getStatusDist = (lancamentos: PainelLancamentoSource[]): StatusDist => {
  const lancComStatus = lancamentos.filter((item) => item.status_consumo);
  const total = lancComStatus.length;
  const baixo = lancComStatus.filter((item) => item.status_consumo === "Baixo").length;
  const ideal = lancComStatus.filter((item) => item.status_consumo === "Ideal").length;
  const alto = lancComStatus.filter((item) => item.status_consumo === "Alto").length;

  return {
    baixo,
    ideal,
    alto,
    baixoPct: total > 0 ? (baixo / total) * 100 : 0,
    idealPct: total > 0 ? (ideal / total) * 100 : 0,
    altoPct: total > 0 ? (alto / total) * 100 : 0,
  };
};

const getPastosNaMeta = (lancamentos: PainelLancamentoSource[]) => {
  const pastosStatus = new Map<string, string>();

  for (const item of lancamentos) {
    if (item.status_consumo) {
      pastosStatus.set(item.pasto_id, item.status_consumo);
    }
  }

  return Array.from(pastosStatus.values()).filter((status) => status === "Ideal").length;
};

const getEficiencia = (lancamentos: PainelLancamentoSource[]) => {
  const indices = lancamentos
    .map((item) => toPositiveNumber(item.indice_consumo))
    .filter((value) => value > 0);

  return indices.length > 0 ? (sumValues(indices) / indices.length) * 100 : 0;
};

const getDerivedLancamentoData = <
  TPasto extends PainelPastoSource,
  TRetiro extends PainelRetiroSource,
  TProduto extends PainelProdutoSource,
>(
  item: PainelLancamentoSource,
  pastosById: Map<string, TPasto>,
  retirosById: Map<string, TRetiro>,
  produtosById: Map<string, TProduto>,
): DerivedLancamentoData => {
  const cabDias = getCabDias(item);
  const pasto = pastosById.get(item.pasto_id);
  const retiro = retirosById.get(item.retiro_id);
  const produtoId = pasto?.produto_id ?? retiro?.produto_id ?? null;
  const produto = produtoId ? produtosById.get(produtoId) : undefined;
  const pesoSacoKg = toPositiveNumber(produto?.peso_saco_kg);
  const precoKg = toPositiveNumber(produto?.preco_por_kg);
  const totalKgFromSacos = toPositiveNumber(item.num_sacos) * pesoSacoKg;
  const totalKgFallback = cabDias > 0 ? (toPositiveNumber(item.consumo_g_cab_dia) * cabDias) / 1000 : 0;
  const totalKgConsumido = totalKgFromSacos > 0 ? totalKgFromSacos : totalKgFallback;
  const totalCusto = totalKgConsumido > 0 && precoKg > 0 ? totalKgConsumido * precoKg : 0;

  return {
    cabDias,
    totalKgConsumido,
    totalCusto,
  };
};

export function calculatePainelMetrics<
  TPasto extends PainelPastoSource,
  TLancamento extends PainelLancamentoSource,
  TProduto extends PainelProdutoSource,
  TRetiro extends PainelRetiroSource,
>({
  pastos,
  lancamentos,
  produtos,
  retiros,
}: {
  pastos: TPasto[];
  lancamentos: TLancamento[];
  produtos: TProduto[];
  retiros: TRetiro[];
}): PainelMetricsAggregate {
  const pastosById = buildById(pastos);
  const retirosById = buildById(retiros);
  const produtosById = buildById(produtos);
  const pastosNoPeriodo = getPastosComLancamento(pastos, lancamentos);

  let totalCabDias = 0;
  let totalKgConsumido = 0;
  let totalCusto = 0;

  for (const item of lancamentos) {
    const derived = getDerivedLancamentoData(item, pastosById, retirosById, produtosById);
    totalCabDias += derived.cabDias;
    totalKgConsumido += derived.totalKgConsumido;
    totalCusto += derived.totalCusto;
  }

  const consumoMedio = totalCabDias > 0 ? (totalKgConsumido * 1000) / totalCabDias : 0;
  const custoDiario = totalCabDias > 0 ? totalCusto / totalCabDias : 0;
  const gmdSource = pastosNoPeriodo.length > 0 ? pastosNoPeriodo : pastos;

  return {
    totalAnimais: getTotalAnimais(pastos, lancamentos),
    sacosUtilizados: sumValues(lancamentos.map((item) => toNumber(item.num_sacos))),
    consumoMedio,
    pastosNaMeta: getPastosNaMeta(lancamentos),
    totalPastos: pastos.length,
    custoDiario,
    custoMensal: totalCusto,
    eficiencia: getEficiencia(lancamentos),
    gmdMedio: getGmdMedio(gmdSource),
    totalSalgas: lancamentos.length,
    statusDist: getStatusDist(lancamentos),
    totalKgConsumido,
    totalCabDias,
    totalCusto,
  };
}

export function calculateRetiroMetrics<
  TPasto extends PainelPastoSource,
  TLancamento extends PainelLancamentoSource,
  TProduto extends PainelProdutoSource,
  TRetiro extends PainelRetiroSource,
>({
  retiroId,
  pastos,
  lancamentos,
  produtos,
  retiros,
}: {
  retiroId: string;
  pastos: TPasto[];
  lancamentos: TLancamento[];
  produtos: TProduto[];
  retiros: TRetiro[];
}): RetiroMetricsAggregate {
  const rPastos = pastos.filter((pasto) => pasto.retiro_id === retiroId);
  const rLanc = lancamentos.filter((item) => item.retiro_id === retiroId);
  const pastosById = buildById(pastos);
  const retirosById = buildById(retiros);
  const produtosById = buildById(produtos);
  const pastosNoPeriodo = getPastosComLancamento(rPastos, rLanc);

  let totalCabDias = 0;
  let totalKgConsumido = 0;
  let totalCusto = 0;

  for (const item of rLanc) {
    const derived = getDerivedLancamentoData(item, pastosById, retirosById, produtosById);
    totalCabDias += derived.cabDias;
    totalKgConsumido += derived.totalKgConsumido;
    totalCusto += derived.totalCusto;
  }

  const consumoMedio = totalCabDias > 0 ? (totalKgConsumido * 1000) / totalCabDias : 0;
  const gmdSource = pastosNoPeriodo.length > 0 ? pastosNoPeriodo : rPastos;

  return {
    totalAnimais: getTotalAnimais(rPastos, rLanc),
    sacosUtilizados: sumValues(rLanc.map((item) => toNumber(item.num_sacos))),
    consumoMedio,
    gmd: getGmdMedio(gmdSource),
    totalKgConsumido,
    totalCabDias,
    totalCusto,
  };
}