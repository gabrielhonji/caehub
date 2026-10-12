export function ThemeToggle({theme,onTheme}:{theme:'light'|'dark';onTheme:()=>void}){
  const label=`Ativar tema ${theme==='light'?'escuro':'claro'}`;
  return <button type="button" className="theme-button" onClick={onTheme} title={label} aria-label={label}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{theme==='light'?<path d="M19.7 15.4A8.3 8.3 0 0 1 8.6 4.3 8.5 8.5 0 1 0 19.7 15.4Z"/>:<><circle cx="12" cy="12" r="3.5"/><path d="M11.25 1h1.5v3h-1.5zm0 19h1.5v3h-1.5zM1 11.25h3v1.5H1zm19 0h3v1.5h-3zM4.4 3.35l2.12 2.12-1.06 1.06-2.12-2.12zm13.08 13.08 2.12 2.12-1.06 1.06-2.12-2.12zM18.54 3.35l1.06 1.06-2.12 2.12-1.06-1.06zM5.46 16.43l1.06 1.06-2.12 2.12-1.06-1.06z"/></>}</svg>
    <span>{theme==='light'?'Escuro':'Claro'}</span>
  </button>;
}
