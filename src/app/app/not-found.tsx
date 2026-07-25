import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-label text-gold-400">
        404
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ground-50">
        Page not found
      </h1>
      <p className="mt-3 text-ground-300">
        That route doesn&apos;t exist. It may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-gold-500 px-5 py-2.5 font-semibold text-ground-950 transition-colors hover:bg-gold-400"
      >
        Back to start
      </Link>
    </div>
  );
}
