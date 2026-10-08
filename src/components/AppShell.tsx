import type { ReactNode } from 'react';
import { Brand } from './Brand';

const links = [{ href: '#/', label: 'Visão geral' }, { href: '#/espacos', label: 'Espaços' }];
export function AppShell({ children, theme, onTheme }: { children: ReactNode; theme: 'light' | 'dark'; onTheme: () => void }) {
  const current = location.hash || '#/';
  return <div className="app-shell"><a className="skip-link" href="#content">Pular para o conteúdo</a><header><div className="header-inner"><Brand /><nav aria-label="Navegação principal">{links.map((link) => <a key={link.href} href={link.href} aria-current={current === link.href ? 'page' : undefined}>{link.label}</a>)}</nav><button className="theme-button" onClick={onTheme} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`}>{theme === 'light' ? '◐ Escuro' : '◑ Claro'}</button></div></header><main id="content" className="content">{children}</main><footer><div><span>CAEHUB · CAECOMP</span><span>Fundação de desenvolvimento</span><span>HONJI</span></div></footer></div>;
}
