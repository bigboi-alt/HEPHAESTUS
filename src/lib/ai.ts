/**
 * HEPHAESTUS · CEDALION AI BRIDGE
 *
 * Optional Bring-Your-Own-Key (BYOK) AI provider integration.
 * Allows Cedalion to tap into state-of-the-art LLMs (Google Gemini, OpenAI,
 * Groq, OpenRouter, or local Ollama) while preserving Cedalion's unique
 * craftsman persona and live palette state awareness.
 *
 * Fully optional. If no key is set or network is unreachable,
 * Cedalion seamlessly runs on its built-in offline brain.
 */

import type { Answer, CedalionContext } from "../engine/cedalion";
import type { Settings } from "./storage";

export async function askCedalionAI(
  question: string,
  ctx: CedalionContext,
  settings?: Settings
): Promise<Answer | null> {
  if (!settings) return null;

  const provider = settings.cedalionAiProvider || "offline";
  const apiKey = (settings.cedalionAiApiKey || "").trim();

  if (provider === "offline" && !apiKey) {
    return null;
  }

  // Build context summary for system prompt
  const p = ctx.palette;
  const paletteSummary = p
    ? `Current active palette: "${p.name}" (${p.mode} mode, ${p.scheme} scheme). Swatches: ${p.swatches.map((s) => `${s.role}: ${s.hex}`).join(", ")}.`
    : "No active palette in workspace.";

  const systemPrompt = `You are Cedalion, the insightful craftsman and guide from Hephaestus design forge.
You are articulate, observant, sharp, witty, and grounded in optical science, geometry, and human perception.
You avoid generic marketing buzzwords and explain concepts with clarity and precision.
${paletteSummary}
Current screen: ${ctx.screen || "workspace"}.

Format your response as clean markdown text. You may also include actionable advice, key takeaways, and suggestions.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

  try {
    if (provider === "gemini" || (apiKey.startsWith("AIza") && provider !== "openai")) {
      // Google Gemini API (gemini-2.0-flash / gemini-1.5-flash)
      const model = settings.cedalionAiModel || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${systemPrompt}\n\nUser asks: "${question}"` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
      });

      clearTimeout(timeoutId);
      if (!res.ok) return null;

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      return parseAIResponse(text);
    } else {
      // OpenAI / Groq / OpenRouter / Ollama
      const baseUrl = settings.cedalionAiBaseUrl?.trim() || "https://api.openai.com/v1";
      const model = settings.cedalionAiModel?.trim() || "gpt-4o-mini";
      const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      });

      clearTimeout(timeoutId);
      if (!res.ok) return null;

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) return null;

      return parseAIResponse(text);
    }
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function parseAIResponse(raw: string): Answer {
  const lines = raw.trim().split("\n");
  const mainText: string[] = [];
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      bullets.push(trimmed.replace(/^[-*•]\s*/, ""));
    } else if (trimmed) {
      mainText.push(trimmed);
    }
  }

  return {
    text: mainText.join("\n\n") || raw.trim(),
    bullets: bullets.length > 0 ? bullets : undefined,
    refs: ["⚡ Answered via Cedalion AI Bridge"],
    suggestions: [
      "Critique my palette",
      "Suggest another direction",
      "How do I improve contrast?",
    ],
  };
}
