export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold">You are offline</h1>
      <p className="text-zinc-400">
        This is the offline shell. Content you visited while online may still be available from the cache.
      </p>
    </div>
  );
}
