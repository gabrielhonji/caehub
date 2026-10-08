import type { ReactNode } from 'react';
import { Brand } from './Brand';

const links = [{ href: '#/', label: 'Visão geral' }, { href: '#/espacos', label: 'Espaços' }];
export function AppShell({ children, theme, onTheme }: { children: ReactNode; theme: 'light' | 'dark'; onTheme: () => void }) {
  const current = location.hash || '#/';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav aria-label="Navegação principal">
            {links.map((link) => <a key={link.href} href={link.href} aria-current={current === link.href ? 'page' : undefined}>{link.label}</a>)}
          </nav>
          <button className="theme-button" onClick={onTheme} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{theme === 'light' ? <path d="M19.7 15.4A8.3 8.3 0 0 1 8.6 4.3 8.5 8.5 0 1 0 19.7 15.4Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4z" /></>}</svg>
            <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>
          </button>
        </div>
      </header>
      <main id="content" className="content">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand"><Brand /></div>
          <div className="footer-credit"><span>UMA FERRAMENTA DO</span><strong>CAECOMP · UTFPR APUCARANA</strong></div>
          <div className="footer-version"><span>CAEHUB — GESTÃO</span><span>CAEHUB v{__APP_VERSION__} · {__APP_RELEASE__}</span></div>
        </div>
      </footer>
    </div>
  );
}
