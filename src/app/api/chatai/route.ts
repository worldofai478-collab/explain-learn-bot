// src/app/api/chatai/route.ts
import { NextResponse } from "next/server";

type Mode = "eli5" | "normal" | "expert";

interface RequestBody {
  message: string;
  mode: Mode;
  wantRoadmap?: boolean;
}

const validModes: readonly Mode[] = ["eli5", "normal", "expert"] as const;
const token = process.env.GROQ_API_KEY;
const model = "llama3-8b-8192";
const endpoint = "https://api.groq.com/openai/v1/chat/completions";

// Prompt builder and memory (keep as is)
function buildSystemMessage(): string {
  return `You are a friendly, clear, and trustworthy teaching assistant. Answer in the fewest words possible. Avoid unnecessary adjectives or explanations. Only include essential information.

When explaining:
- ELI5 → Use simple, playful language, short sentences, and analogies for a child.
- NORMAL → Beginner-friendly, define terms, give one example.
- EXPERT → Deep technical explanation, include key terms, references, and next steps.

When giving a roadmap:
- Always structure it step-by-step like a flowchart or numbered path.
- Each step: short title → key action → time estimate → 1–2 resources (title + URL) → one quick exercise/project.
- Keep it realistic for a beginner unless told otherwise.

If something important is missing (e.g., time commitment, goal), ask ONE short clarifying question before giving the roadmap.

Before answering:
1. Think through the structure.
2. Present it in an easy-to-read format with a short summary at the top.`;
}

function buildPromptFromInputs(message: string, mode: Mode, wantRoadmap?: boolean): string {
  const explanationInstruction =
    mode === "eli5"
      ? "Explain simply for a child. Use a short analogy, clear words, and 2–3 short sentences."
      : mode === "expert"
      ? "Give a detailed, technical explanation with key terms, examples, and next-step references."
      : "Explain clearly for a beginner. Define terms and give one example.";

  const roadmapInstruction = wantRoadmap
    ? `\n\nThen create a roadmap as a simple flowchart (6–8 steps). For each step:
1. Step name
2. What to do
3. Estimated time
4. 1–2 resources (title + URL)
5. A small project/exercise

Keep it concise and visually clear.`
    : "";

  const jsonInstruction = `
Format your entire output as a JSON object with these keys:
- "summary": a short summary of the answer
- "explanation": the main explanation
${wantRoadmap ? '- "roadmap": an array of roadmap steps, each with {stepName, action, timeEstimate, resources, exercise}' : ''}
Do not include anything outside the JSON object.
`;

  return `${explanationInstruction}${roadmapInstruction}\n\nUser query: "${message}"\n\nFirst, plan the structure in your head. Then present the answer cleanly.\n${jsonInstruction}`;
}

// Temporary in-memory memory (last 5 exchanges)
const memory: { message: string; reply: string }[] = [];

function normalizeRoadmap(roadmap: any[]): any[] {
  if (!Array.isArray(roadmap)) return [];
  return roadmap.map((step) => ({
    stepName: step.stepName || "",
    action: step.action || "",
    timeEstimate: step.timeEstimate || "",
    resources: Array.isArray(step.resources)
      ? step.resources.map((res: any) => {
          if (typeof res === "string") {
            const [title, url] = res.split(/,(?=\s*https?:\/\/)/);
            return url
              ? { title: title?.trim() || url.trim(), url: url.trim() }
              : { title: res.trim(), url: "" };
          }
          return res;
        })
      : [],
    exercise: step.exercise || "",
  }));
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();

    if (!body?.message?.trim()) {
      return NextResponse.json({ error: "Missing or empty 'message' in request body" }, { status: 400 });
    }

    if (!validModes.includes(body.mode)) {
      return NextResponse.json({ error: `Invalid 'mode'. Must be one of: ${validModes.join(", ")}` }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "Server misconfiguration: missing GROQ_API_KEY" }, { status: 500 });
    }

    // Add previous exchanges to context
    const previousExchanges = memory
      .slice(-5)
      .map((ex, i) => `Previous Q${i + 1}: "${ex.message}"\nPrevious A${i + 1}: "${ex.reply}"`)
      .join("\n");

    const systemMessage = buildSystemMessage();
    const userPrompt = buildPromptFromInputs(body.message.trim(), body.mode, body.wantRoadmap);

    const fullPrompt =
      (previousExchanges ? previousExchanges + "\n\n" : "") +
      userPrompt;

    const groqRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.5,
        top_p: 1,
      }),
    });

    const data = await groqRes.json();
    let content = data?.choices?.[0]?.message?.content || "";

    let jsonReply;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      jsonReply = jsonMatch ? JSON.parse(jsonMatch[0]) : { explanation: content };
    } catch {
      jsonReply = { explanation: content };
    }

    if (jsonReply.roadmap) {
      jsonReply.roadmap = normalizeRoadmap(jsonReply.roadmap);
    }

    // Save to memory (keep only last 5)
    memory.push({ message: body.message.trim(), reply: content });
    if (memory.length > 5) memory.shift();

    return NextResponse.json({
      explanation: jsonReply.explanation,
      roadmap: jsonReply.roadmap || undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: String(err) }, { status: 500 });
  }
}
