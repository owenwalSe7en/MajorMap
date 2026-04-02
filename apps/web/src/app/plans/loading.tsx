export default function PlansLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-32 rounded bg-muted animate-pulse mb-6" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3 min-h-[200px]">
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-10 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="lg:w-72 shrink-0">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-2 rounded-full bg-muted animate-pulse" />
          </div>
        </aside>
      </div>
    </main>
  );
}
