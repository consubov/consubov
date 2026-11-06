import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QuiescentForm } from '../../packages/ui/src/QuiescentForm';
import { globalQuiescenceRegistry as registry } from '../../packages/module-release/src/quiescence/registry';
import { installModuleQuiescenceBridge } from '../../packages/module-release/src/quiescence/module-bridge';

const pending: Array<(saved: boolean) => void> = [];
const channel = new MessageChannel();
installModuleQuiescenceBridge(channel.port2, { moduleId: 'capataz', nonce: crypto.randomUUID() });
channel.port1.start();
function App() {
  const [first, setFirst] = useState('baseline');
  const [second, setSecond] = useState('baseline');
  const [score, setScore] = useState(false);
  return <>
    <QuiescentForm id="first" onSubmit={() => new Promise<boolean>(resolve => pending.push(resolve))}>
      <input aria-label="first" value={first} onChange={event => setFirst(event.target.value)} />
      <button type="button" role="radio" aria-checked={score} onClick={() => setScore(value => !value)}>score</button>
      <button type="submit">save first</button>
    </QuiescentForm>
    <QuiescentForm id="second" onSubmit={() => new Promise<boolean>(resolve => pending.push(resolve))}>
      <input aria-label="second" value={second} onChange={event => setSecond(event.target.value)} />
      <button type="submit">save second</button>
    </QuiescentForm>
  </>;
}
Object.assign(window, {
  fixture: {
    counts: () => registry.getActiveLocks().map(lock => lock.type),
    save: (success: boolean) => pending.shift()?.(success),
    prepare: () => registry.prepareActivation(),
    release: (leaseId: string) => registry.releaseActivation(leaseId),
    frozen: () => registry.isFrozen()
  }
});
createRoot(document.getElementById('root')!).render(<App />);
