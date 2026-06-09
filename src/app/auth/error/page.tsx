export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <div className="max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Sign-in failed</h1>
        <p className="text-sm text-zinc-400">
          Something went wrong while signing you in. This usually clears up on a
          second try.
        </p>
        <a
          href="/login"
          className="inline-block rounded-xl bg-cyan-400 px-5 py-2.5 font-semibold text-black transition hover:bg-cyan-300"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
