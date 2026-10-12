export function Brand({href='#/'}:{href?:string}) {
  return (
    <a className="brand" href={href} aria-label="CAECOMP / CAEHUB, início">
      <span className="cae-mark" aria-hidden="true" />
      <span className="brand-copy">
        <strong>CAEHUB</strong>
        <small>Gestão do CAECOMP</small>
      </span>
    </a>
  );
}

export function HonjiBrand() {
  return <a className="honji-brand" href="https://gabriel.honji.com.br" aria-label="HONJI, abrir portfólio"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="/assets/honji-symbol.svg#mark" /></svg><strong>HONJI</strong></a>;
}
