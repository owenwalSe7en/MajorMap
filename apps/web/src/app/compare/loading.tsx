export default function CompareLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="h-10 rounded-md border bg-muted animate-pulse" />
        <div className="h-10 rounded-md border bg-muted animate-pulse" />
      </div>
      <div className="h-10 w-24 rounded bg-muted animate-pulse" />
    </main>
  );
}
