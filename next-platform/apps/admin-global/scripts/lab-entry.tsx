import { App } from '../src/App';

/** This entry is reachable only through the explicit --mode lab build alias. */
export function AdminEntry() {
  return <><aside role="note" style={{ padding: 12, background: '#fef3c7', color: '#78350f' }}>Laboratório de simulação — contas, permissões e operações demonstrativas.</aside><App /></>;
}
