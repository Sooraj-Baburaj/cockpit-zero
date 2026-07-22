/** Mono uppercase section label. */
export function Eyebrow({
  children,
  inverse = false,
}: {
  children: React.ReactNode;
  inverse?: boolean;
}) {
  return (
    <span
      className={`font-mono text-xs font-medium tracking-[0.14em] uppercase ${inverse ? 'text-inverse-muted' : 'text-muted'}`}
    >
      {children}
    </span>
  );
}
