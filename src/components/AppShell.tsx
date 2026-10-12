import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AgendaNotifications } from './AgendaNotifications';
import { Brand, HonjiBrand } from './Brand';
import { getSessionInfo } from '../services/spaces';
import { ThemeToggle } from './ThemeToggle';

export function AppShell({ children, theme, onTheme }: { children: ReactNode; theme: 'light' | 'dark'; onTheme: () => void }) {
  type DebugMode = 'real'|'global_admin'|'caecomp_admin'|'events_director'|'events_member'|'products_member'|'xii_admin'|'xii_secretary_member'|'xii_sports_member';
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
          <nav aria-label="Navegação do CAEHUB"><a className="home-link" href="#/" aria-current={current === '#/' ? 'page' : undefined} aria-label="Início"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg></a><a href="#/minhas-tarefas" aria-current={current === '#/minhas-tarefas' ? 'page' : undefined}>Minhas tarefas</a><a href="#/agenda" aria-current={current === '#/agenda' ? 'page' : undefined}>Agenda</a><a href="#/comercial" aria-current={current === '#/comercial' ? 'page' : undefined}>Comercial</a><a href="#/meus-pedidos" aria-current={current.startsWith("#/meus-pedidos") ? "page" : undefined}>Meus pedidos</a><a href="#/espacos" aria-current={current === '#/espacos' ? 'page' : undefined}>Espaços</a></nav>
          <div className="header-actions"><AgendaNotifications/><ThemeToggle theme={theme} onTheme={onTheme}/><div className="account-control" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}><button className="account-avatar" type="button" aria-label="Abrir opções da conta" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>{initials}</button>{profileOpen && <div className="account-panel"><a className="account-name" href="https://gabriel.honji.com.br/#perfil">{account?.displayName ?? 'Conta Honji'}<span>Editar perfil</span></a><a href="https://gabriel.honji.com.br/#acesso">Minha conta</a><button type="button" disabled={!account || signingOut} onClick={() => void logout()}>{signingOut ? 'Saindo…' : 'Sair'}</button></div>}</div></div>
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
      {account?.debugView?.available&&<aside className="debug-view-switcher"><label>Visualizar como<select aria-label="Perfil de visualização" value={account.debugView.mode} onChange={e=>void setDebugView(e.target.value as DebugMode)}><optgroup label="Administração"><option value="real">Minha conta</option><option value="global_admin">Administrador global</option></optgroup><optgroup label="CAECOMP"><option value="caecomp_admin">Administração / Presidência</option><option value="events_director">Diretor de Eventos</option><option value="events_member">Membro de Eventos</option><option value="products_member">Membro de Produtos</option></optgroup><optgroup label="XII"><option value="xii_admin">Administração / Presidência</option><option value="xii_secretary_member">Membro da Secretaria</option><option value="xii_sports_member">Membro de Esportes</option></optgroup></select></label></aside>}
    </div>
  );
}
