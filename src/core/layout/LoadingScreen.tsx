export function LoadingScreen({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface" role="status">
      <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">{label.toUpperCase()}</p>
    </div>
  )
}
