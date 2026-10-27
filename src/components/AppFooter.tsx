import type {ReactNode} from 'react';
import {Brand,HonjiBrand} from './Brand';

export function AppFooter({reportAction}:{reportAction:ReactNode}){
 return <footer className="site-footer"><div className="footer-inner"><div className="footer-identities"><HonjiBrand/><span className="navbar-divider" aria-hidden="true"/><Brand/></div><div className="footer-signature"><span>DESENVOLVIDO POR</span><a href="https://github.com/gabrielhonji" target="_blank" rel="noreferrer">gabriel.honji</a></div><div className="footer-release"><div className="footer-report">{reportAction}</div><span className="footer-version"><span>HONJI — CAECOMP</span><span>CAEHUB v{__APP_VERSION__} · {__APP_RELEASE__}</span></span></div></div></footer>;
}
