/**
 * Temporary stand-in used while a section is not built yet.
 * Delete once every section has real content.
 */
export function PlaceholderCard({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
