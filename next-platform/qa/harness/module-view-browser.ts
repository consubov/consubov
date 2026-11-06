import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import type { ModuleExecutionContext, ModuleLocalDataAPI } from '@consubov/contracts';
import { CapatazView } from '../../apps/fazenda/capataz/src/CapatazView';
import { GerenteView } from '../../apps/fazenda/gerente/src/GerenteView';
import { EscritorioView } from '../../apps/fazenda/escritorio/src/EscritorioView';
import { FabricaView } from '../../apps/fazenda/fabrica/src/FabricaView';

export function mountModuleView(container: HTMLElement, context: ModuleExecutionContext, localData: ModuleLocalDataAPI) {
  const root = createRoot(container);
  const View = { capataz: CapatazView, gerente: GerenteView, escritorio: EscritorioView, fabrica: FabricaView }[context.moduleId];
  root.render(React.createElement(I18nProvider, { language: 'pt-BR' },
    React.createElement(ModuleRuntimeProvider, { localData, children: React.createElement(View, { context }) })));
  return root;
}
