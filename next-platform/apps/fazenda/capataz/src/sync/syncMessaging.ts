/**
 * Mensageria Cross-Tab reativa via W3C BroadcastChannel
 * Permite que a aba Líder notifique abas seguidoras sobre atualizações na outbox,
 * início de sincronização, progresso, conclusão e conflitos.
 */

export type SyncMessageType =
  | 'OUTBOX_UPDATED'
  | 'SYNC_STARTED'
  | 'SYNC_PROGRESS'
  | 'SYNC_COMPLETED'
  | 'CONFLICT_DETECTED'
  | 'LEADER_ELECTED';

export interface SyncMessage<T = any> {
  type: SyncMessageType;
  partitionKey: string;
  timestamp: string;
  senderTabId?: string;
  payload?: T;
}

export interface SyncChannelController {
  partitionKey: string;
  channelName: string;
  postMessage: (type: SyncMessageType, payload?: any) => void;
  onMessage: (handler: (msg: SyncMessage) => void) => () => void;
  close: () => void;
}

// Barramento em memória para fallback quando BroadcastChannel nativo não existir
class InMemoryBroadcastBus {
  private channels: Map<string, Set<(msg: SyncMessage) => void>> = new Map();

  subscribe(channelName: string, listener: (msg: SyncMessage) => void): () => void {
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, new Set());
    }
    this.channels.get(channelName)!.add(listener);

    return () => {
      this.channels.get(channelName)?.delete(listener);
      if (this.channels.get(channelName)?.size === 0) {
        this.channels.delete(channelName);
      }
    };
  }

  publish(channelName: string, msg: SyncMessage, senderListener?: (msg: SyncMessage) => void) {
    const listeners = this.channels.get(channelName);
    if (listeners) {
      listeners.forEach(listener => {
        // BroadcastChannel padrão não envia de volta para o próprio objeto emissor
        if (listener !== senderListener) {
          try {
            listener(msg);
          } catch {
            // Silencia erros de handlers de terceiros
          }
        }
      });
    }
  }

  reset() {
    this.channels.clear();
  }
}

export const inMemoryBroadcastBus = new InMemoryBroadcastBus();

/**
 * Cria ou conecta ao canal de mensageria da partição.
 */
export function createSyncMessagingChannel(
  partitionKey: string,
  tabId?: string
): SyncChannelController {
  const channelName = `consubov:sync:${partitionKey}`;
  const listeners: Set<(msg: SyncMessage) => void> = new Set();

  const hasNativeBroadcast = typeof BroadcastChannel !== 'undefined';
  let nativeChannel: BroadcastChannel | null = null;
  let inMemoryUnsub: (() => void) | null = null;

  const dispatchToLocalListeners = (msg: SyncMessage) => {
    listeners.forEach(cb => {
      try {
        cb(msg);
      } catch {
        // Ignora falhas em listeners locais
      }
    });
  };

  if (hasNativeBroadcast) {
    nativeChannel = new BroadcastChannel(channelName);
    nativeChannel.onmessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        dispatchToLocalListeners(event.data as SyncMessage);
      }
    };
  } else {
    inMemoryUnsub = inMemoryBroadcastBus.subscribe(channelName, (msg) => {
      dispatchToLocalListeners(msg);
    });
  }

  const postMessage = (type: SyncMessageType, payload?: any) => {
    const msg: SyncMessage = {
      type,
      partitionKey,
      timestamp: new Date().toISOString(),
      senderTabId: tabId,
      payload
    };

    if (nativeChannel) {
      nativeChannel.postMessage(msg);
    } else {
      inMemoryBroadcastBus.publish(channelName, msg, dispatchToLocalListeners);
    }
  };

  const onMessage = (handler: (msg: SyncMessage) => void) => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  };

  const close = () => {
    listeners.clear();
    if (nativeChannel) {
      nativeChannel.close();
      nativeChannel = null;
    }
    if (inMemoryUnsub) {
      inMemoryUnsub();
      inMemoryUnsub = null;
    }
  };

  return {
    partitionKey,
    channelName,
    postMessage,
    onMessage,
    close
  };
}

export function resetSyncMessagingForTesting() {
  inMemoryBroadcastBus.reset();
}
