/**
 * Coordenação de Eleição de Líder Cross-Tab via W3C Web Locks API (navigator.locks)
 * Garante que apenas uma aba da mesma partição execute a sincronização de outbox por vez.
 * Suporta fallback em memória seguro para ambientes headless / testes Bun.
 */

export interface LeaderElectionController {
  partitionKey: string;
  isLeader(): boolean;
  release(): void;
  onLeaderChange(callback: (isLeader: boolean) => void): () => void;
}

// Gerenciador em memória para ambientes headless e testes de concorrência cross-tab
class InMemoryLockManager {
  private activeLocks: Map<string, string> = new Map(); // lockName -> tabId
  private listeners: Map<string, Set<(holderTabId: string | null) => void>> = new Map();

  requestLock(
    lockName: string,
    tabId: string,
    onAcquired: () => void,
    onLost: () => void
  ): () => void {
    const currentHolder = this.activeLocks.get(lockName);

    if (!currentHolder) {
      this.activeLocks.set(lockName, tabId);
      onAcquired();
    } else if (currentHolder === tabId) {
      onAcquired();
    } else {
      onLost();
    }

    let isSubscribed = true;
    const listener = (holder: string | null) => {
      if (!isSubscribed) return;
      if (holder === tabId) {
        onAcquired();
      } else if (!holder) {
        // Tentativa de adquirir o lock liberado
        if (!this.activeLocks.has(lockName)) {
          this.activeLocks.set(lockName, tabId);
          onAcquired();
          this.notify(lockName, tabId);
        }
      } else {
        onLost();
      }
    };

    if (!this.listeners.has(lockName)) {
      this.listeners.set(lockName, new Set());
    }
    this.listeners.get(lockName)!.add(listener);

    return () => {
      isSubscribed = false;
      this.listeners.get(lockName)?.delete(listener);
      if (this.activeLocks.get(lockName) === tabId) {
        this.activeLocks.delete(lockName);
        this.notify(lockName, null);
      }
    };
  }

  release(lockName: string, tabId: string) {
    if (this.activeLocks.get(lockName) === tabId) {
      this.activeLocks.delete(lockName);
      this.notify(lockName, null);
    }
  }

  private notify(lockName: string, holder: string | null) {
    const subs = this.listeners.get(lockName);
    if (subs) {
      const currentSubs = Array.from(subs);
      for (const cb of currentSubs) {
        cb(holder);
      }
    }
  }

  reset() {
    this.activeLocks.clear();
    this.listeners.clear();
  }
}

export const inMemoryLockManager = new InMemoryLockManager();

let tabCounter = 0;
export function generateTabId(): string {
  tabCounter += 1;
  return `tab-${Date.now()}-${tabCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Inicia a eleição de líder para a partição informada.
 */
export function startLeaderElection(
  partitionKey: string,
  onLeaderChange?: (isLeader: boolean) => void,
  customTabId?: string
): LeaderElectionController {
  const lockName = `consubov:outbox-leader:${partitionKey}`;
  const tabId = customTabId || generateTabId();
  let leaderState = false;
  let isReleased = false;
  let abortController: AbortController | null = null;
  let inMemoryRelease: (() => void) | null = null;
  const callbacks: Set<(isLeader: boolean) => void> = new Set();

  if (onLeaderChange) {
    callbacks.add(onLeaderChange);
  }

  const setLeader = (newLeader: boolean) => {
    if (isReleased) {
      leaderState = false;
      return;
    }
    if (leaderState !== newLeader) {
      leaderState = newLeader;
      callbacks.forEach(cb => cb(newLeader));
    }
  };

  const hasNativeWebLocks =
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof (navigator as any).locks?.request === 'function';

  if (hasNativeWebLocks) {
    abortController = new AbortController();
    (navigator as any).locks.request(
      lockName,
      { mode: 'exclusive', signal: abortController.signal },
      () => {
        setLeader(true);
        return new Promise<void>((resolve) => {
          if (abortController) {
            abortController.signal.addEventListener('abort', () => {
              setLeader(false);
              resolve();
            });
          }
        });
      }
    ).catch(() => {
      setLeader(false);
    });
  } else {
    // Fallback gracioso para ambiente in-memory
    inMemoryRelease = inMemoryLockManager.requestLock(
      lockName,
      tabId,
      () => setLeader(true),
      () => setLeader(false)
    );
  }

  return {
    partitionKey,
    isLeader: () => leaderState,
    release: () => {
      isReleased = true;
      leaderState = false;
      callbacks.forEach(cb => cb(false));
      if (abortController) {
        abortController.abort();
      }
      if (inMemoryRelease) {
        inMemoryRelease();
        inMemoryRelease = null;
      }
      inMemoryLockManager.release(lockName, tabId);
    },
    onLeaderChange: (cb: (isLeader: boolean) => void) => {
      callbacks.add(cb);
      // Notifica o estado atual imediatamente
      cb(leaderState);
      return () => {
        callbacks.delete(cb);
      };
    }
  };
}

export function resetLeaderElectionForTesting() {
  inMemoryLockManager.reset();
}
