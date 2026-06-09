import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

// Agent runs can take a while (reasoning + web search). Give the function room.
export const maxDuration = 60;

// Gemini 2.5 Flash is fast, capable, and available on Google's free tier.
// Swapping providers later is a one-line model change.
const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are ClawMind — an autonomous AI agent that finishes real work.

The user hands you a single goal. Your job is to deliver the FINISHED result, not a plan or a list of steps you "would" take. Do the work and present the completed deliverable.

Guidelines:
- If current, real-world, or factual information matters, use Google Search to look it up rather than guessing.
- Produce a polished, self-contained answer the user can use immediately (an email, a plan, code, research findings, a draft, etc.).
- Use clear formatting (headings, lists) when it helps readability.
- Be thorough but do not pad. Quality over length.`;

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Record the task immediately so it survives even if the run is slow.
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
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Google Search grounding lets the agent pull in current, real info.
        tools: [{ googleSearch: {} }],
      },
    });

    const resultText = (response.text ?? "").trim();

    const { data: updated } = await supabase
      .from("tasks")
      .update({
        status: "done",
        result: resultText || "(The agent returned no text.)",
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
