import {
  QuiescenceRegistry,
  QuiescenceLockInfo,
  globalQuiescenceRegistry
} from '@consubov/module-release';

export interface UpdateCoordinatorOptions {
  checkIntervalMs?: number;
  quiescenceRegistry?: QuiescenceRegistry;
  onUpdateAvailable?: (version?: string) => void;
  onUpdateActivated?: (version?: string) => void;
  onWaitingForQuiescence?: (activeLocks: ReadonlyArray<QuiescenceLockInfo>) => void;
  autoReloadOnQuiescent?: boolean;
}

export class UpdateCoordinator {
  private registration: ServiceWorkerRegistration | null = null;
  private isUpdatePending = false;
  private isWaitingForQuiescence = false;
  private pollIntervalId: NodeJS.Timeout | number | null = null;
  private readonly quiescenceRegistry: QuiescenceRegistry;
  private readonly autoReload: boolean;
  private controllerChangeHandler: (() => void) | null = null;

  constructor(private readonly options: UpdateCoordinatorOptions = {}) {
    this.quiescenceRegistry = options.quiescenceRegistry ?? globalQuiescenceRegistry;
    this.autoReload = options.autoReloadOnQuiescent ?? true;
  }

  public initialize(registration: ServiceWorkerRegistration): void {
    this.registration = registration;

    // 1. Caso já exista um worker instalado aguardando ativação (waiting)
    if (registration.waiting) {
      this.handleWaitingWorker(registration.waiting);
    }

    // 2. Monitora instalação de novos workers em segundo plano
    registration.onupdatefound = () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.onstatechange = () => {
        // Se concluiu a instalação e já existe controlador ativo, é uma atualização pronta
        const hasController =
          typeof navigator !== 'undefined' &&
          'serviceWorker' in navigator &&
          Boolean(navigator.serviceWorker.controller);

        if (installing.state === 'installed' && (hasController || registration.waiting === installing)) {
          this.handleWaitingWorker(installing);
        }
      };
    };

    // 3. Monitora controllerchange para ativação transparente
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      this.controllerChangeHandler = () => {
        console.log('[UpdateCoordinator] Nova versão assumiu o controle da aplicação.');
        this.options.onUpdateActivated?.();

        if (this.autoReload && typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
          // Recarrega apenas se o estado estiver quiescente
          if (this.quiescenceRegistry.isQuiescent()) {
            window.location.reload();
          } else {
            // Se por algum motivo surgir trava imediatamente antes do reload, aguarda
            this.quiescenceRegistry.whenQuiescent().then(() => {
              window.location.reload();
            });
          }
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', this.controllerChangeHandler);
    }

    // 4. Polling periódico silencioso em segundo plano (default 15 minutos)
    const checkIntervalMs = this.options.checkIntervalMs ?? 15 * 60 * 1000;
    if (checkIntervalMs > 0) {
      this.pollIntervalId = setInterval(() => {
        this.checkForUpdates().catch(() => {});
      }, checkIntervalMs);
    }
  }

  public async checkForUpdates(): Promise<void> {
    if (!this.registration) return;
    try {
      await this.registration.update();
    } catch (err) {
      console.warn('[UpdateCoordinator] Verificação de atualização falhou ou offline:', err);
    }
  }

  public async handleWaitingWorker(worker: ServiceWorker): Promise<void> {
    this.isUpdatePending = true;
    this.options.onUpdateAvailable?.();

    // Se houver qualquer trava ativa (edição de formulário, câmera, pesagem ou outbox)
    if (!this.quiescenceRegistry.isQuiescent()) {
      this.isWaitingForQuiescence = true;
      const locks = this.quiescenceRegistry.getActiveLocks();
      console.log(
        `[UpdateCoordinator] Atualização retida aguardando ponto de quiescência. Travas ativas (${locks.length}):`,
        locks.map((l) => l.type).join(', ')
      );
      this.options.onWaitingForQuiescence?.(locks);

      // Bloqueia e aguarda a liberação de todas as travas
      await this.quiescenceRegistry.whenQuiescent();
      this.isWaitingForQuiescence = false;
    }

    console.log('[UpdateCoordinator] Ponto de quiescência confirmado. Enviando SKIP_WAITING ao Service Worker...');
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  public isPending(): boolean {
    return this.isUpdatePending;
  }

  public isHoldingForQuiescence(): boolean {
    return this.isWaitingForQuiescence;
  }

  public destroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (
      this.controllerChangeHandler &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.removeEventListener('controllerchange', this.controllerChangeHandler);
      this.controllerChangeHandler = null;
    }

    this.registration = null;
  }
}
