import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/plans";
import { runSwarm } from "@/lib/swarm";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let prompt: string;
  try {
    const body = await request.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "A task is required" }, { status: 400 });
  }
  if (prompt.length > 4000) {
    return Response.json(
      { error: "Task is too long (max 4000 characters)" },
      { status: 400 }
    );
  }

  // Check plan limits
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .single();

  const planId: PlanId = (sub?.plan as PlanId) ?? "spark";
  const plan = PLANS[planId];
  const limit = plan.monthlyTasks;

  if (limit !== null) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "error")
      .gte("created_at", monthStart.toISOString());

    if ((count ?? 0) >= limit) {
      return Response.json(
        {
          error: `You've used all ${limit} tasks on the ${plan.name} plan this month. Upgrade to run more.`,
          limitReached: true,
          plan: planId,
        },
        { status: 402 }
      );
    }
  }

  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({ user_id: user.id, prompt, status: "running" })
    .select()
    .single();

  if (insertError || !task) {
    return Response.json(
      { error: "Could not save task: " + (insertError?.message ?? "unknown") },
      { status: 500 }
    );
  }

  try {
    // Run the 8-agent swarm: Superhuman plans → specialists work →
    // Beam synthesizes → Echo finalizes.
    const { result: resultText, agentsUsed } = await runSwarm(prompt);

    const { data: updated } = await supabase
      .from("tasks")
      .update({
        status: "done",
        result: resultText || "(The swarm returned no text.)",
        agents: agentsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .select()
      .single();

    return Response.json({ task: updated ?? { ...task, status: "done", result: resultText } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The agent failed.";
    await supabase
      .from("tasks")
      .update({ status: "error", error: message, updated_at: new Date().toISOString() })
      .eq("id", task.id);

    return Response.json(
      { task: { ...task, status: "error", error: message } },
      { status: 500 }
    );
  }
}
