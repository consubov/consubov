import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AdminApiService } from './admin-service';
import { createAdminUpdater } from './admin-update';

const copy = {
  pt: { title: 'ADM CONSUBOV', signIn: 'Acesso administrativo', email: 'E-mail', password: 'Senha', enter: 'Entrar', wait: 'Aguarde…', choose: 'Selecione o vínculo autorizado', access: 'Acessar este contexto', cancel: 'Cancelar', logout: 'Sair', audit: 'Auditoria', refresh: 'Atualizar consulta', empty: 'Nenhuma operação registrada.', command: 'Operação', status: 'Resultado', date: 'Data', tenant: 'Organização', accessError: 'Acesso administrativo não autorizado. Confira suas credenciais e permissões.', unavailable: 'Não foi possível consultar o serviço. Faça o acesso novamente.', expired: 'Seu acesso expirou. Entre novamente.', update: 'Há uma atualização do Aplicativo pronta para instalar.', install: 'Instalar atualização', work: 'Conclua ou cancele o trabalho em andamento antes de atualizar.', windows: 'Feche as outras janelas do aplicativo para atualizar.', updateFailure: 'Não foi possível instalar a atualização. Tente novamente.', origin: 'Abra o ADM CONSUBOV pelo endereço autorizado.', scope: 'Acesso administrativo somente para consulta.', language: 'Idioma', portuguese: 'Português', english: 'English' },
  en: { title: 'ADM CONSUBOV', signIn: 'Administrative access', email: 'Email', password: 'Password', enter: 'Sign in', wait: 'Please wait…', choose: 'Select an authorized membership', access: 'Open this context', cancel: 'Cancel', logout: 'Sign out', audit: 'Audit', refresh: 'Refresh results', empty: 'No operations recorded.', command: 'Operation', status: 'Result', date: 'Date', tenant: 'Organization', accessError: 'Administrative access denied. Check your credentials and permissions.', unavailable: 'The service could not be reached. Sign in again.', expired: 'Your access expired. Sign in again.', update: 'An Application update is ready to install.', install: 'Install update', work: 'Complete or cancel your current work before updating.', windows: 'Close the other application windows to update.', updateFailure: 'The update could not be installed. Try again.', origin: 'Open ADM CONSUBOV at its authorized address.', scope: 'Administrative access is read only.', language: 'Language', portuguese: 'Português', english: 'English' }
};
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: 12, marginBlock: '6px 18px', border: '1px solid #64748b', borderRadius: 6, font: 'inherit' };
const buttonStyle: React.CSSProperties = { padding: '12px 18px', margin: '4px 8px 4px 0', border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#fff', font: 'inherit', cursor: 'pointer' };

/** Publishable entry has no dependency on the privileged simulation application. */
export function AdminEntry() {
  const [language, setLanguage] = useState<'pt' | 'en'>('pt'), c = copy[language];
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false), [updateReason, setUpdateReason] = useState<'work' | 'windows' | 'unavailable' | null>(null);
  const [updating, setUpdating] = useState(false);
  const frozen = useRef(false), updater = useRef<ReturnType<typeof createAdminUpdater> | null>(null);
  const service = useMemo(() => new AdminApiService({ canStart: () => !frozen.current }), []);
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const latest = useRef({ state, email, password }); latest.current = { state, email, password };
  const correctOrigin = location.origin === __ADM_ORIGIN__;
  useEffect(() => { document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en-US'; }, [language]);
  useEffect(() => {
    if (!correctOrigin) return;
    const controller = createAdminUpdater({
      canActivate: () => !frozen.current && !latest.current.state.busy && latest.current.state.phase !== 'choose-context' &&
        !(latest.current.state.phase === 'signed-out' && (latest.current.email.length > 0 || latest.current.password.length > 0)),
      freeze: value => { frozen.current = value; setUpdating(value); }, available: setUpdateAvailable, blocked: setUpdateReason
    });
    updater.current = controller;
    return () => { controller.dispose(); updater.current = null; };
  }, [correctOrigin]);
  useEffect(() => () => service.dispose(), [service]);
  const logout = () => { setEmail(''); setPassword(''); service.logout(); };
  const accessError = state.error === 'access' ? c.accessError : state.error === 'expired' ? c.expired : state.error ? c.unavailable : null;
  return <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
    <header style={{ background: '#0f172a', color: '#fff', padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <strong style={{ fontSize: 20 }}>{c.title}</strong>
      <label style={{ marginInlineStart: 'auto' }}>{c.language} <select aria-label={c.language} value={language} onChange={event => setLanguage(event.target.value as 'pt' | 'en')}><option value="pt">{c.portuguese}</option><option value="en">{c.english}</option></select></label>
      {state.phase !== 'signed-out' && <button style={{ ...buttonStyle, borderColor: '#cbd5e1' }} onClick={logout}>{c.logout}</button>}
    </header>
    <main style={{ padding: 24, maxWidth: state.phase === 'authorized' ? 1200 : 520, margin: 'auto' }}>
      {!correctOrigin ? <p role="alert">{c.origin}</p> : <>
        {accessError && <p role="alert">{accessError}</p>}
        {state.phase === 'signed-out' && <form data-testid="admin-login" onSubmit={event => { event.preventDefault(); void service.login(email, password).then(success => { if (success) setPassword(''); }); }}>
          <h1>{c.signIn}</h1>
          <label htmlFor="admin-email">{c.email}</label><input id="admin-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} />
          <label htmlFor="admin-password">{c.password}</label><input id="admin-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} />
          <button style={buttonStyle} type="submit" disabled={state.busy}>{state.busy ? c.wait : c.enter}</button>
        </form>}
        {state.phase === 'choose-context' && <section data-testid="admin-context"><h1>{c.choose}</h1>{state.memberships.map(member => <div key={member.id}><p>{member.name}</p><button style={buttonStyle} disabled={state.busy} onClick={() => { void service.selectContext(member.id).then(success => { if (success) { setEmail(''); setPassword(''); } }); }}>{state.busy ? c.wait : c.access}</button></div>)}<button style={buttonStyle} onClick={logout}>{c.cancel}</button></section>}
        {state.phase === 'authorized' && <section data-testid="admin-audit"><h1>{c.audit}</h1><p>{state.name}</p><p>{c.scope}</p>
          <button style={buttonStyle} disabled={state.busy} onClick={() => { void service.refreshAudit(); }}>{state.busy ? c.wait : c.refresh}</button>
          {!state.audit.length ? <p>{c.empty}</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'start', borderCollapse: 'collapse' }}><thead><tr>{[c.command, c.status, c.date, c.tenant].map(label => <th scope="col" key={label} style={{ padding: 12 }}>{label}</th>)}</tr></thead><tbody>{state.audit.map(row => <tr key={row.commandId}><td style={{ padding: 12 }}>{row.commandType}</td><td style={{ padding: 12 }}>{row.status}</td><td style={{ padding: 12 }}>{new Date(row.storedAt).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US')}</td><td style={{ padding: 12 }}>{row.tenantId}</td></tr>)}</tbody></table></div>}
        </section>}
      </>}
    </main>
    {correctOrigin && updateAvailable && <aside aria-live="polite" style={{ padding: 20, margin: 16, border: '1px solid #64748b', background: '#fff' }}><p>{c.update}</p><button style={buttonStyle} disabled={updating} onClick={() => { setUpdateReason(null); void updater.current?.activate(); }}>{updating ? c.wait : c.install}</button>{updateReason && <p role="alert">{updateReason === 'work' ? c.work : updateReason === 'windows' ? c.windows : c.updateFailure}</p>}</aside>}
  </div>;
}
