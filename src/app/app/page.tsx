import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgentConsole, { type Task } from "./agent-console";

export const metadata = {
  title: "ClawMind — Agent Console",
};

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AgentConsole
      email={user.email ?? "you"}
      initialTasks={(tasks as Task[]) ?? []}
    />
  );
}
