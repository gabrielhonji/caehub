export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="HONJI CAEHUB, início">
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <use href="/assets/honji-symbol.svg#mark" />
      </svg>
      <span className="brand-copy">
        <strong>HONJI</strong>
        <small>CAEHUB</small>
      </span>
    </a>
  );
}
