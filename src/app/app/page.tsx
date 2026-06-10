import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/plans";
import AgentConsole, { type Task } from "./agent-console";

export const metadata = {
  title: "ClawMind — Agent Console",
};

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: tasks }, { data: sub }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("plan, status").eq("user_id", user.id).single(),
  ]);

  const planId: PlanId = (sub?.plan as PlanId) ?? "spark";

  // Count tasks used this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: usedThisMonth } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "error")
    .gte("created_at", monthStart.toISOString());

  const plan = PLANS[planId];

  return (
    <AgentConsole
      email={user.email ?? "you"}
      initialTasks={(tasks as Task[]) ?? []}
      planId={planId}
      planName={plan.name}
      monthlyLimit={plan.monthlyTasks}
      usedThisMonth={usedThisMonth ?? 0}
    />
  );
}
