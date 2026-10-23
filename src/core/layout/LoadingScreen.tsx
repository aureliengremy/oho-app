export function LoadingScreen({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface" role="status">
      <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{label}</p>
    </div>
  )
}
