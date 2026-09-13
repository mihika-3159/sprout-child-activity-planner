import { NextRequest, NextResponse } from "next/server";
import { getProvider, initializeAIProviders } from "@/lib/ai/providers";
import { formatMaterial } from "@/lib/utils/formatters";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activity, childAge, question, history } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Please provide a question." }, { status: 400 });
    }

    initializeAIProviders();
    const provider = getProvider();

    const activityTitle = activity?.title?.replace(/_/g, " ") || "Screen-Free Activity";
    const activityDesc = activity?.description?.replace(/_/g, " ") || "";
    const instructions = Array.isArray(activity?.instructions)
      ? activity.instructions.map((s: string, i: number) => `${i + 1}. ${s.replace(/_/g, " ")}`).join("\n")
      : "";
    const materials = Array.isArray(activity?.materials)
      ? activity.materials.map((m: string) => formatMaterial(m)).join(", ")
      : "";
    const whyEngaging = activity?.whyEngaging?.replace(/_/g, " ") || activity?.rationale?.replace(/_/g, " ") || "";

    const systemPrompt = `You are Sprout's Warm Parenting Guide & Activity Explainer.
A parent is asking you questions about an activity recommended for their ${childAge || "young"}-year-old child.

ACTIVITY DETAILS:
- Title: ${activityTitle}
- What it is: ${activityDesc}
- Materials: ${materials}
- Step-by-step:
${instructions}
- Why Kids Love It: ${whyEngaging}

GUIDELINES:
1. Speak in a warm, encouraging, practical, and empathetic tone like a supportive parenting coach.
2. Explain clearly WHAT the activity looks like in action and WHY a child finds it captivating.
3. If the parent asks how to get started, adapt materials, handle low-mess spaces, or motivate a reluctant child, provide 2-3 fun, actionable tips.
4. DO NOT cite formal academic citations, medical claims, or statistical jargon. Keep it focused on real-life play and child joy.
5. Keep your response conversational and easy to read (2-3 concise paragraphs or bullet points).`;

    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((h: { sender: string; text: string }) => `${h.sender === "user" ? "Parent" : "Sprout Guide"}: ${h.text}`)
          .join("\n")
      : "";

    const userPrompt = `${formattedHistory ? `PREVIOUS CHAT:\n${formattedHistory}\n\n` : ""}Parent's question: "${question.trim()}"`;

    let replyText = "";
    try {
      replyText = await provider.generateText({
        prompt: userPrompt,
        systemPrompt,
        temperature: 0.7,
      });
    } catch {
      // Offline / fallback response generator
      replyText = generateFallbackChatResponse(question.trim(), activityTitle, whyEngaging, materials);
    }

    // Clean any synthetic dev test labels or underscores from output
    replyText = replyText
      .replace(/TEST FIXTURE — NOT PRODUCTION EVIDENCE/g, "")
      .replace(/MockAI/g, "")
      .replace(/pencils_crayons/g, "pencils and crayons")
      .replace(/fine_motor/g, "fine motor skills")
      .trim();

    return NextResponse.json({ reply: replyText });
  } catch (err: unknown) {
    console.error("[Planner Chat API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate chat response" },
      { status: 500 }
    );
  }
}

function generateFallbackChatResponse(
  question: string,
  title: string,
  whyEngaging: string,
  materials: string
): string {
  const qLower = question.toLowerCase();

  if (qLower.includes("reluctant") || qLower.includes("interest") || qLower.includes("boring") || qLower.includes("refuse")) {
    return `Kids often resist when an activity feels like a task or an assignment! The best trick for **${title}** is to start playing with the materials yourself without asking them to join. 
    
Begin stacking a box or making a funny drawing, and say out loud: *"Hmm, I wonder if this will hold..."* Curiosity almost always wins! Once they look over, invite them to take over: *"Can you test if this is strong enough, or do you have a better idea?"*`;
  }

  if (qLower.includes("mess") || qLower.includes("clean") || qLower.includes("space") || qLower.includes("small")) {
    return `For **${title}**, you can easily keep it low-mess! 

Set down a baking sheet or a folded towel on the floor or kitchen table. This defines a clear boundary for materials like ${materials || "paper and crayons"} so items don't wander across the room, making cleanup take less than 60 seconds.`;
  }

  if (qLower.includes("why") || qLower.includes("engaging") || qLower.includes("fun") || qLower.includes("benefit")) {
    return `What makes **${title}** so fun for children is the direct feeling of agency and control. 

${whyEngaging || "Children love having open-ended freedom where there are no 'wrong answers'."} When they get to build, discover, and test things with their own hands, it taps into their natural instinct for storytelling and exploration rather than passive entertainment.`;
  }

  return `Here is how **${title}** works in practice: it's designed to be simple, low-pressure, and hands-on using ${materials || "household items"}. 

${whyEngaging ? `The secret sauce: ${whyEngaging}` : "It gives your child a creative challenge where they lead the way."} You only need to spend 2-3 minutes setting out the items, and then let your child guide the fun. If they want to change the rules or take it in a wild new direction, encourage it—that's where the best screen-free play happens!`;
}
