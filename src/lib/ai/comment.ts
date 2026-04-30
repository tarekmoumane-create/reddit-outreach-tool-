import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./research";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CommentInput = {
  client: {
    name: string;
    url: string;
    description: string | null;
    profile?: BrandProfile | null;
  };
  post: {
    title: string;
    subreddit: string;
    summary: string | null;
  };
};

const SYSTEM_PROMPT = `You are writing a Reddit comment for a brand. Your single most important goal: the comment must read as if a real human typed it on their phone. If anything in your output looks AI-generated, you have failed.

Voice and structure:
- Lead with genuine help: specific advice, your own experience, or what actually worked for you. Do NOT lead with the brand.
- Match the subreddit's tone. Casual where appropriate. Use first person and concrete details. Lowercase where it reads more natural (most casual subs).
- Keep the helpful part to 3-5 sentences. The brand mention, if you include one, is one sentence max.

When (and how) to mention the brand:
- Mention at most once, near the end, casually, like "i've been using {brand} for this and it actually helped" or "{brand} is what i ended up trying". An afterthought, not a pitch.
- Use the brand name lowercased unless it would look genuinely wrong in context.
- If a brand mention would feel forced or salesy in this specific post, skip it entirely. A helpful comment with no mention beats a forced one.

ABSOLUTELY NO em dashes (—) or en dashes (–). This is the #1 AI tell — humans almost never type these, especially on Reddit. Use commas, periods, or parentheses instead. If you find yourself reaching for an em dash, rewrite the sentence with a comma or break it into two sentences.

Other AI tells to avoid:
- Smart/curly quotes (" " ' '). Use straight quotes only (" and ').
- Tricolons and balanced parallel structures ("it's fast, it's simple, it's effective").
- Throat-clearing openers: "Honestly,", "Look,", "I get it,", "It's worth noting that", "Ultimately,", "In essence,".
- Phrases like "navigate", "delve", "tapestry", "leverage", "robust", "seamless", "revolutionary", "next-level", "powerful", "comprehensive".
- Overly polished structure. Real people ramble a little, use sentence fragments, and don't always close every loop.

Hard rules:
- Do NOT start with "Hey", "Hi", "Hi there", or any greeting. Jump straight into the substance.
- Banned phrases: "check out", "highly recommend", "game changer", "must-try", "definitely worth", "you should try", "can't recommend enough".
- No URLs. No links. Never link to the brand's site.
- No headings, no emoji, no bold, no bullet lists, no numbered lists.

Output JSON only, matching this schema exactly:
{"comment": "<the comment body, plain text — no em dashes>"}`;

export async function generateComment(input: CommentInput): Promise<string> {
  const p = input.client.profile;
  const userParts: string[] = [
    `Brand: ${input.client.name}`,
    `URL: ${input.client.url}`,
  ];
  if (p?.summary) userParts.push(`What they do: ${p.summary}`);
  else if (input.client.description)
    userParts.push(`What they do: ${input.client.description}`);
  if (p?.tone) userParts.push(`Brand tone to emulate: ${p.tone}`);
  if (p?.value_props?.length)
    userParts.push(`Differentiators (use sparingly): ${p.value_props.join("; ")}`);

  userParts.push(
    "",
    `Reddit post to reply to:`,
    `- Subreddit: r/${input.post.subreddit}`,
    `- Title: ${input.post.title}`,
  );
  if (input.post.summary)
    userParts.push(`- Body: ${input.post.summary.slice(0, 1200)}`);

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const text =
    resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Comment parse failed: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as { comment?: string };
  if (!parsed.comment) {
    throw new Error(`Comment missing: ${text.slice(0, 200)}`);
  }
  return sanitizeComment(parsed.comment);
}

// Hard guarantee no em/en dashes or smart quotes ever land in a generated
// comment, even if the model ignores the prompt rule. Em dashes are the
// loudest AI tell on Reddit; this is enforced as a contract, not a hint.
export function sanitizeComment(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();
}
