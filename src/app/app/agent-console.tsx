"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PLANS, type PlanId } from "@/lib/plans";

export type Task = {
  id: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export default function AgentConsole({
  email,
  initialTasks,
  planId,
  planName,
  monthlyLimit,
  usedThisMonth,
}: {
  email: string;
  initialTasks: Task[];
  planId: PlanId;
  planName: string;
  monthlyLimit: number | null;
  usedThisMonth: number;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const atLimit = monthlyLimit !== null && usedThisMonth >= monthlyLimit;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || running || atLimit) return;

    setRunning(true);
    setError(null);
    setLimitReached(false);

    const tempId = `temp-${Date.now()}`;
    const placeholder: Task = {
      id: tempId,
      prompt: trimmed,
      status: "running",
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [placeholder, ...prev]);
    setPrompt("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();

      if (res.status === 402 || data?.limitReached) {
        setLimitReached(true);
        setError(data?.error ?? "Task limit reached. Please upgrade.");
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        return;
      }

      if (data?.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === tempId ? (data.task as Task) : t))
        );
      } else {
        throw new Error(data?.error ?? "Something went wrong.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === tempId ? { ...t, status: "error", error: message } : t
        )
      );
    } finally {
      setRunning(false);
    }
  };

  const upgrade = async (targetPlan: PlanId) => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
      else setError(data?.error ?? "Could not start checkout.");
    } catch {
      setError("Could not start checkout.");
    } finally {
      setUpgrading(false);
    }
  };

  const manageSubscription = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
      else setError(data?.error ?? "Could not open billing portal.");
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setUpgrading(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const nextPlan = getNextPlan(planId);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_3px_rgba(34,211,238,0.7)]" />
            ClawMind
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">{email}</span>
            {planId !== "spark" && (
              <button
                onClick={manageSubscription}
                disabled={upgrading}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                Manage plan
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Plan badge */}
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/20">
            {planName} plan
          </span>
          {monthlyLimit !== null ? (
            <span className="text-xs text-zinc-500">
              {usedThisMonth} / {monthlyLimit} tasks this month
            </span>
          ) : (
            <span className="text-xs text-zinc-500">Unlimited tasks</span>
          )}
        </div>

        {/* Limit banner */}
        {(atLimit || limitReached) && nextPlan && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-medium text-amber-300">
              You&apos;ve used all {monthlyLimit} tasks on the {planName} plan this month.
            </p>
            <div className="mt-3">
              <button
                onClick={() => upgrade(nextPlan.id)}
                disabled={upgrading}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {upgrading ? "Loading…" : `Upgrade to ${nextPlan.name} — $${nextPlan.usd}/mo`}
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <section className="mt-8">
          <h1 className="text-2xl font-bold tracking-tight">
            What should your swarm finish?
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Describe a goal. ClawMind researches and delivers the finished work.
          </p>

          <form onSubmit={submit} className="mt-5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
              }}
              disabled={atLimit}
              placeholder={
                atLimit
                  ? "Task limit reached — upgrade to continue."
                  : "e.g. Research the top 3 project-management tools for a 5-person startup and recommend one with reasons."
              }
              rows={4}
              maxLength={4000}
              className="w-full resize-y rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-[15px] leading-relaxed outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-zinc-600">⌘/Ctrl + Enter to run</span>
              <button
                type="submit"
                disabled={running || !prompt.trim() || atLimit}
                className="rounded-xl bg-cyan-400 px-5 py-2.5 font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? "Working…" : "Run agent"}
              </button>
            </div>
          </form>

          {error && !limitReached && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </section>

        {/* Upgrade nudge for Spark users who haven't hit the limit yet */}
        {planId === "spark" && !atLimit && nextPlan && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-5 py-3">
            <p className="text-sm text-zinc-500">
              Free plan · {monthlyLimit! - usedThisMonth} tasks left this month
            </p>
            <button
              onClick={() => upgrade(nextPlan.id)}
              disabled={upgrading}
              className="rounded-lg bg-white/8 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/12 disabled:opacity-50"
            >
              Upgrade →
            </button>
          </div>
        )}

        {/* History */}
        <section className="mt-8 space-y-4 pb-12">
          {tasks.length === 0 && (
            <p className="text-sm text-zinc-600">
              No tasks yet. Your finished work will appear here.
            </p>
          )}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      </div>
    </main>
  );
}

function getNextPlan(current: PlanId): { id: PlanId; name: string; usd: number } | null {
  const order: PlanId[] = ["spark", "build", "pro", "max", "enterprise"];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return null;
  const next = order[idx + 1];
  const p = PLANS[next];
  return { id: next, name: p.name, usd: p.usd };
}

function TaskCard({ task }: { task: Task }) {
  const [open, setOpen] = useState(task.status === "done");

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <StatusBadge status={task.status} />
        <span className="flex-1 text-[15px] font-medium text-zinc-100">
          {task.prompt}
        </span>
        <span className="mt-1 text-zinc-600">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 py-4">
          {task.status === "running" && (
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400/40 border-t-cyan-300" />
              The agent is researching and writing…
            </p>
          )}
          {task.status === "error" && (
            <p className="text-sm text-red-400">
              {task.error ?? "The agent ran into an error."}
            </p>
          )}
          {task.status === "done" && (
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
              {task.result}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: Task["status"] }) {
  const map: Record<Task["status"], { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-zinc-700/40 text-zinc-300" },
    running: { label: "Running", cls: "bg-cyan-500/15 text-cyan-300" },
    done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300" },
    error: { label: "Error", cls: "bg-red-500/15 text-red-300" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
