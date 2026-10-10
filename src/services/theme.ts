export type Theme = 'light' | 'dark';
const KEY = 'honji-theme';
const COOKIE = 'honji_theme';

export function readTheme(): Theme | null {
  const cookie = document.cookie.split('; ').find(item => item.startsWith(`${COOKIE}=`))?.split('=')[1];
  if (cookie === 'light' || cookie === 'dark') return cookie;
  try { const saved = localStorage.getItem(KEY); return saved === 'light' || saved === 'dark' ? saved : null; } catch { return null; }
}

export function saveTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* Cookie remains available. */ }
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${theme}; Domain=.honji.com.br; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
