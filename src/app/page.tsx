import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Clawmind
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          Your Next.js + Supabase scaffold is ready.
        </p>

        {user ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-left space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Signed in as
            </p>
            <p className="text-zinc-900 dark:text-zinc-100 font-mono text-sm">
              {user.email}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            Not signed in.{" "}
            <a
              href="/auth/login"
              className="underline text-zinc-700 dark:text-zinc-300"
            >
              Sign in
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
