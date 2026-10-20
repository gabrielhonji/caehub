export type Theme = 'light' | 'dark';
const KEY = 'honji-theme';
const COOKIE = 'honji_theme';

export function readTheme(): Theme | null {
  const cookie = document.cookie.split(';').map(item=>item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.split('=')[1];
  if (cookie === 'light' || cookie === 'dark') return cookie;
  try { const saved = localStorage.getItem(KEY); return saved === 'light' || saved === 'dark' ? saved : null; } catch { return null; }
}

export function saveTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* Cookie remains available. */ }
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const domain=location.hostname==='honji.com.br'||location.hostname.endsWith('.honji.com.br')?'; Domain=.honji.com.br':'';
  if(domain)document.cookie=`${COOKIE}=; Path=/; Max-Age=0`;
  document.cookie = `${COOKIE}=${theme}${domain}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
