import { GoogleGenAI } from "@google/genai";
import { AGENTS, DOERS, type AgentName, type DoerName } from "./agents";

const MODEL = "gemini-2.5-flash";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

async function callAgent(
  name: AgentName,
  contents: string,
  web = false
): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: AGENTS[name].system,
      ...(web ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  return (res.text ?? "").trim();
}

type Assignment = { agent: DoerName; brief: string };

// Phase 1 — Superhuman decides which Forces to summon.
async function planAssignments(goal: string): Promise<Assignment[]> {
  const prompt = `User's goal:
"""${goal}"""

Summon the right specialist Forces. Available Forces:
- ember: games — playable game concepts, mechanics, and working game code
- lumen: film — cinematic video, storyboards, shot lists, scripts
- relay: automation — workflows, scripts, integrations, automated busywork
- forge: business — decks, business plans, financial models, strategy
- echo: creator studio — content scripts, captions, posts, content calendars
- sage: learning — tutoring, lessons, explanations, study plans
- beam: apps & websites — full app/website design and code, idea to deployable

Return ONLY a JSON array, each item: {"agent": "<name>", "brief": "<specific instruction for that Force>"}.
Summon 1–3 Forces — only the ones genuinely needed for this goal. No commentary.`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: AGENTS.superhuman.system,
      responseMimeType: "application/json",
    },
  });

  try {
    const parsed = JSON.parse(res.text ?? "[]");
    if (Array.isArray(parsed)) {
      const valid = parsed
        .filter(
          (a) => a && DOERS.includes(a.agent) && typeof a.brief === "string"
        )
        .slice(0, 3);
      if (valid.length > 0) return valid;
    }
  } catch {
    // fall through to default
  }
  // Fallback: let Sage handle it as a general request.
  return [{ agent: "sage", brief: goal }];
}

export type SwarmResult = {
  result: string;
  agentsUsed: AgentName[];
};

export async function runSwarm(goal: string): Promise<SwarmResult> {
  // Phase 1 — Superhuman plans.
  const assignments = await planAssignments(goal);
  const usedDoers = assignments.map((a) => a.agent);

  // Phase 2 — The summoned Forces work in parallel.
  const contributions = await Promise.all(
    assignments.map(async (a) => {
      const out = await callAgent(
        a.agent,
        `The overall goal is:\n"""${goal}"""\n\nYour specific assignment:\n${a.brief}`,
        AGENTS[a.agent].web
      );
      return { agent: a.agent, text: out };
    })
  );

  const agentsUsed: AgentName[] = ["superhuman", ...usedDoers];

  // If only one Force was needed, return its work directly.
  if (contributions.length === 1) {
    return { result: contributions[0].text, agentsUsed };
  }

  // Phase 3 — Superhuman assembles all contributions into one deliverable.
  const synthesisInput = `User's goal:
"""${goal}"""

The Forces delivered:
${contributions
  .map((c) => `### ${AGENTS[c.agent].title} (${AGENTS[c.agent].tagline})\n${c.text}`)
  .join("\n\n")}

Assemble these into ONE coherent, complete, ready-to-use deliverable that fully achieves the user's goal. Do not mention the Forces or the process — just deliver the finished work.`;

  const final = await callAgent("superhuman", synthesisInput);

  return { result: final || contributions.map((c) => c.text).join("\n\n"), agentsUsed };
}
