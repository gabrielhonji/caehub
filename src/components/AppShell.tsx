import type { ReactNode } from 'react';
import { Brand, HonjiBrand } from './Brand';

export function AppShell({ children, theme, onTheme }: { children: ReactNode; theme: 'light' | 'dark'; onTheme: () => void }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Pular para o conteúdo</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="navbar-brands"><HonjiBrand /><span className="navbar-divider" aria-hidden="true" /><Brand /></div>
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
          <div className="footer-organization"><strong>CAECOMP</strong><span>Centro Acadêmico de Engenharia de Computação</span></div>
          <div className="footer-signature"><span>DESENVOLVIDO POR</span><a href="https://github.com/gabrielhonji" target="_blank" rel="noreferrer">gabriel.honji</a><i aria-hidden="true">·</i><span>VERSÃO {__APP_VERSION__}</span><i aria-hidden="true">·</i><span>UTFPR / APUCARANA</span></div>
        </div>
      </footer>
    </div>
  );
}
