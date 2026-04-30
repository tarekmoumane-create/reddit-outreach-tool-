import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type BrandProfile = {
  summary: string;
  industry: string;
  audience: string;
  tone: string;
  value_props: string[];
  pain_points: string[];
  competitors: string[];
  subreddits: string[];
  keywords: string[];
};

const SYSTEM_PROMPT = `You are a brand researcher preparing a Reddit outreach campaign. Given a company's name, URL, and raw scraped text from their homepage, output a structured profile the outreach tool will use to (a) find relevant Reddit posts and (b) write genuine helpful comments.

Output valid JSON only, matching this schema exactly:
{
  "summary": "2-3 sentences on what the company does and why someone would care",
  "industry": "short label, e.g. 'DTC cold-brew coffee', 'B2B AI sales tooling', 'indie iOS productivity app'",
  "audience": "1-2 sentences describing who buys or uses this",
  "tone": "how they talk — e.g. 'casual and playful', 'authoritative and technical', 'earnest and story-driven'",
  "value_props": ["3-5 specific differentiators or strengths"],
  "pain_points": ["3-5 concrete customer problems this product solves"],
  "competitors": ["3-5 comparable companies, products, or product categories a customer would compare against"],
  "subreddits": ["exactly 15 real subreddit names (no r/ prefix) where the target audience hangs out, ordered most-to-least likely"],
  "keywords": ["exactly 20 natural Reddit-search phrases a customer would actually type when venting, asking for advice, or describing their problem — NOT the brand name, NOT marketing copy"]
}

Guidance:
- Keywords: 2-5 word phrases in plain language. Think "best crm for small teams", "coffee subscription worth it", "standing desk under 500". Avoid jargon that only the company uses.
- Subreddits: mix direct audience hangouts with adjacent/context subreddits. Prefer specific over generic. Avoid r/AskReddit, r/NoStupidQuestions, etc.
- If the scraped text is thin or marketing-heavy, infer reasonably from the name, URL path, and industry conventions — do not refuse.`;

export async function researchBrand(input: {
  name: string;
  url: string;
  siteText: string;
}): Promise<BrandProfile> {
  const user = [
    `Brand name: ${input.name}`,
    `URL: ${input.url}`,
    "",
    "--- SCRAPED SITE TEXT (may be noisy) ---",
    input.siteText.slice(0, 8000),
  ].join("\n");

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Research parse failed: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as Partial<BrandProfile>;

  if (
    !parsed.summary ||
    !Array.isArray(parsed.subreddits) ||
    !Array.isArray(parsed.keywords)
  ) {
    throw new Error("Research output missing required fields");
  }

  return {
    summary: parsed.summary ?? "",
    industry: parsed.industry ?? "",
    audience: parsed.audience ?? "",
    tone: parsed.tone ?? "",
    value_props: (parsed.value_props ?? []).slice(0, 5),
    pain_points: (parsed.pain_points ?? []).slice(0, 5),
    competitors: (parsed.competitors ?? []).slice(0, 5),
    subreddits: (parsed.subreddits ?? []).slice(0, 15),
    keywords: (parsed.keywords ?? []).slice(0, 20),
  };
}
