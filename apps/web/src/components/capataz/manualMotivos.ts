export const MOTIVO_MANUAL_MIN = 5;

export function resolverMotivoManual(motivoEspecifico: string, motivoGeral: string): string {
  return motivoEspecifico.trim() || motivoGeral.trim();
}

export function motivoManualValido(motivoEspecifico: string, motivoGeral: string): boolean {
  return resolverMotivoManual(motivoEspecifico, motivoGeral).length >= MOTIVO_MANUAL_MIN;
}
