import React, { useId, useLayoutEffect, useRef } from 'react';
import { globalQuiescenceRegistry } from '@consubov/module-release';

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  /** Resolve true only after the real local commit. A void/no-op/error cannot declare the form saved. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => unknown;
};

function snapshot(form: HTMLFormElement): string {
  return JSON.stringify(Array.from(form.querySelectorAll('input,select,textarea,[aria-checked],[aria-pressed]')).map(element => {
    if (element instanceof HTMLInputElement) return [element.type, element.value, element.checked, Array.from(element.files ?? []).map(file => [file.name, file.size, file.lastModified])];
    if (element instanceof HTMLSelectElement) return Array.from(element.selectedOptions).map(option => option.value);
    if (element instanceof HTMLTextAreaElement) return element.value;
    return [element.getAttribute('aria-checked'), element.getAttribute('aria-pressed')];
  }));
}

/** Keeps each form's dirty state private and acquires before invoking asynchronous persistence. */
export function QuiescentForm({ onSubmit, ...props }: Props) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const state = useRef({ baseline: '', edits: 0, touched: false, pending: 0, releaseDirty: null as null | (() => void) });
  const refresh = () => {
    const form = formRef.current;
    if (!form) return;
    const current = state.current;
    if (!current.touched) current.baseline = snapshot(form);
    const dirty = current.touched && snapshot(form) !== current.baseline;
    if (dirty && !current.releaseDirty) current.releaseDirty = globalQuiescenceRegistry.acquireLock(`form:${id}`, 'FORM_DIRTY');
    if (!dirty && current.releaseDirty) { current.releaseDirty(); current.releaseDirty = null; }
  };
  useLayoutEffect(refresh);
  useLayoutEffect(() => {
    const form = formRef.current!;
    const changed = () => {
      if (globalQuiescenceRegistry.isFrozen()) return;
      state.current.touched = true;
      state.current.edits++;
      // Native input is observed synchronously, then React-controlled and radio-button state after its commit.
      refresh();
      queueMicrotask(refresh);
    };
    const click = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest('[aria-checked],[aria-pressed]') : null;
      if (!element || globalQuiescenceRegistry.isFrozen()) return;
      state.current.touched = true;
      state.current.edits++;
      if (!state.current.releaseDirty) state.current.releaseDirty = globalQuiescenceRegistry.acquireLock(`form:${id}`, 'FORM_DIRTY');
      queueMicrotask(refresh);
    };
    form.addEventListener('input', changed, true);
    form.addEventListener('change', changed, true);
    form.addEventListener('click', click, true);
    return () => {
      form.removeEventListener('input', changed, true);
      form.removeEventListener('change', changed, true);
      form.removeEventListener('click', click, true);
      state.current.releaseDirty?.();
      state.current.releaseDirty = null;
    };
  }, [id]);
  return <form {...props} ref={formRef} onSubmit={event => {
    event.preventDefault();
    if (globalQuiescenceRegistry.isFrozen() || !onSubmit) return;
    const form = event.currentTarget;
    const edits = state.current.edits;
    const submitted = snapshot(form);
    const release = globalQuiescenceRegistry.acquireLock(`form-save:${id}:${++state.current.pending}`, 'LOCAL_DB_TRANSACTION');
    try {
      const result = onSubmit(event);
      if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') { release(); return; }
      void Promise.resolve(result).then(saved => {
        if (saved === true && edits === state.current.edits && formRef.current === form) {
          state.current.baseline = submitted;
          refresh();
        }
      }, () => { /* The existing handler/store owns user-visible errors; dirty data stays protected. */ }).finally(release);
    } catch { release(); }
  }} />;
}
