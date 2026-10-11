import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AgendaNotifications } from './AgendaNotifications';
import { Brand, HonjiBrand } from './Brand';
import { getSessionInfo } from '../services/spaces';

export function AppShell({ children, theme, onTheme }: { children: ReactNode; theme: 'light' | 'dark'; onTheme: () => void }) {
  type DebugMode = 'real' | 'admin' | 'events_director' | 'member';
  const current = location.hash || '#/';
  const [profileOpen, setProfileOpen] = useState(false);
  const [account, setAccount] = useState<{ displayName: string; csrfToken: string; debugView?: { available: boolean; mode: DebugMode } }>();
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let active = true;
    getSessionInfo().then(value => {
      if (active && value?.displayName) setAccount({ displayName: value.displayName, csrfToken: value.csrfToken ?? '', debugView: value.debugView });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest('.account-control')) setProfileOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);
  async function logout() {
    if (!account || signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': account.csrfToken } });
      const result = await response.json();
      if (response.ok && result.redirect) location.assign(result.redirect);
      else setSigningOut(false);
    } catch { setSigningOut(false); }
  }
  async function setDebugView(mode: DebugMode) {
    if (!account) return;
    const response = await fetch('/api/debug-view', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': account.csrfToken }, body: JSON.stringify({ mode }) });
    if (response.ok) location.reload();
  }
  const initials = account?.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'CH';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="navbar-brands"><HonjiBrand /><span className="navbar-divider" aria-hidden="true" /><Brand /></div>
          <nav aria-label="Navegação do CAEHUB"><a className="home-link" href="#/" aria-current={current === '#/' ? 'page' : undefined} aria-label="Início"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg></a><a href="#/minhas-tarefas" aria-current={current === '#/minhas-tarefas' ? 'page' : undefined}>Minhas tarefas</a><a href="#/agenda" aria-current={current === '#/agenda' ? 'page' : undefined}>Agenda</a><a href="#/comercial" aria-current={current === '#/comercial' ? 'page' : undefined}>Comercial</a><a href="#/espacos" aria-current={current === '#/espacos' ? 'page' : undefined}>Espaços</a></nav>
          <div className="header-actions"><AgendaNotifications/><button className="theme-button" onClick={onTheme} title={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{theme === 'light' ? <path d="M19.7 15.4A8.3 8.3 0 0 1 8.6 4.3 8.5 8.5 0 1 0 19.7 15.4Z" /> : <><circle cx="12" cy="12" r="3.5" /><path d="M11.25 1h1.5v3h-1.5zm0 19h1.5v3h-1.5zM1 11.25h3v1.5H1zm19 0h3v1.5h-3zM4.4 3.35l2.12 2.12-1.06 1.06-2.12-2.12zm13.08 13.08 2.12 2.12-1.06 1.06-2.12-2.12zM18.54 3.35l1.06 1.06-2.12 2.12-1.06-1.06zM5.46 16.43l1.06 1.06-2.12 2.12-1.06-1.06z" /></>}</svg>
              <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>
            </button><div className="account-control" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}><button className="account-avatar" type="button" aria-label="Abrir opções da conta" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>{initials}</button>{profileOpen && <div className="account-panel"><a className="account-name" href="https://gabriel.honji.com.br/#perfil">{account?.displayName ?? 'Conta Honji'}<span>Editar perfil</span></a><a href="https://gabriel.honji.com.br/#acesso">Minha conta</a><button type="button" disabled={!account || signingOut} onClick={() => void logout()}>{signingOut ? 'Saindo…' : 'Sair'}</button></div>}</div></div>
        </div>
      </header>
      <main id="content" className="content">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand"><Brand /></div>
          <div className="footer-organization"><strong>CAECOMP</strong><span>Centro Acadêmico de Engenharia de Computação</span></div>
          <div className="footer-signature"><span>DESENVOLVIDO POR</span><a href="https://github.com/gabrielhonji" target="_blank" rel="noreferrer">gabriel.honji</a><i aria-hidden="true">·</i><span>VERSÃO {__APP_VERSION__} · {__APP_RELEASE__}</span><i aria-hidden="true">·</i><span>UTFPR / APUCARANA</span></div>
        </div>
      </footer>
      {account?.debugView?.available && <aside className="debug-view-switcher" aria-label="Visualização de depuração"><span>Visualizar como</span><div>{([
        ['real', 'Minha conta'], ['admin', 'Admin / Presidência'], ['events_director', 'Diretor Eventos'], ['member', 'Membro'],
      ] as [DebugMode, string][]).map(([mode, label]) => <button type="button" key={mode} aria-pressed={account.debugView?.mode === mode} onClick={() => void setDebugView(mode)}>{label}</button>)}</div></aside>}
    </div>
  );
}
