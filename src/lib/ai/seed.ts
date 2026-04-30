import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./research";
import { sanitizeComment } from "./comment";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SeedClient = {
  name: string;
  url: string;
  description: string | null;
  profile?: BrandProfile | null;
};

export type SeedPostDraft = {
  title: string;
  body: string;
};

export type SeedCommentBundle = {
  organic_1: string;
  organic_2: string;
  plug: string;
};

const POST_SYSTEM_PROMPT = `You are writing a Reddit post for a content-seeding campaign. The post itself must NOT mention or hint at any specific brand. It should read as if a real person, on their phone, opened a subreddit and posted a question or short story or take that fits naturally there. Plant the topic; the brand mention will happen later in a comment, not here.

Voice and structure:
- First person. Casual. Match the subreddit's tone — most subs are lowercase-leaning and conversational. Some (e.g. r/AskHistorians, niche professional subs) are more formal; adjust.
- Title: a real question or take a person would actually post. Not a headline. No clickbait. 60-120 chars usually.
- Body: 2-6 sentences. Set up a real situation, then ask the question or invite discussion. Concrete details ground it as authentic.
- The post is about a problem, situation, or question in the brand's niche. It must be something a genuine human in the target audience would actually want answered or discussed.

ABSOLUTELY NO em dashes (—) or en dashes (–). Humans almost never type these on Reddit. Use commas, periods, or two sentences.

Other AI tells to avoid:
- Smart/curly quotes. Use straight quotes only.
- Tricolons and balanced parallel structures.
- Throat-clearing openers: "Honestly,", "Look,", "I get it,", "It's worth noting".
- Phrases like "navigate", "delve", "tapestry", "leverage", "robust", "seamless", "revolutionary", "comprehensive".
- Polished structure. Real posts ramble a little, use fragments, leave threads dangling.

Hard rules:
- Do NOT mention the brand name, URL, or any of its specific product names anywhere in the title or body.
- Do NOT name competitors by name either — keep it about the situation, not products.
- No headings, no emoji, no bold, no bullet/numbered lists in the body.
- No URLs.

Output JSON only, matching this schema exactly:
{"title": "<post title — plain text, no em dashes>", "body": "<post body — plain text, no em dashes>"}`;

const COMMENTS_SYSTEM_PROMPT = `You are writing three candidate comments for a Reddit post that we ourselves planted. Two must be fully organic (no brand mention at all). The third must sound just as organic but include a casual, off-hand mention of the brand, like a real person briefly recommending what worked for them.

All three comments must read as if a real human on their phone wrote them. If any one of them looks AI-generated, you have failed.

Voice and structure for ALL three:
- First person. Casual. Match the subreddit's tone.
- Lead with a specific, useful thought: personal experience, concrete advice, or a real reaction to the post.
- 2-5 sentences each. Lowercase where it reads more natural. Sentence fragments are fine.
- The three should sound like three different people. Vary sentence length, opening word, and angle (e.g. one shares experience, one gives advice, one disagrees gently or adds nuance).

For the brand-plug comment specifically:
- The plug is ONE casual sentence, near the end, like "i ended up trying {brand} and it actually helped" or "{brand} is the one i landed on after burning a few weekends on this".
- Use the brand name lowercased unless that would look genuinely wrong.
- The plug must feel like an afterthought from a real user, not a pitch. The bulk of the comment is genuine help, the plug is the throwaway.

ABSOLUTELY NO em dashes (—) or en dashes (–) in any comment. Use commas, periods, or two sentences.

Other AI tells to avoid in all three:
- Smart/curly quotes. Use straight quotes only.
- Tricolons and balanced parallel structures.
- Throat-clearing openers: "Honestly,", "Look,", "I get it,", "It's worth noting", "Ultimately,".
- Phrases like "navigate", "delve", "tapestry", "leverage", "robust", "seamless", "revolutionary", "comprehensive", "powerful", "next-level".
- Polished structure. Real comments are messy.

Hard rules for ALL three:
- Do NOT start with "Hey", "Hi", "Hi there", or any greeting.
- Banned phrases: "check out", "highly recommend", "game changer", "must-try", "definitely worth", "you should try", "can't recommend enough".
- No URLs. No links.
- No headings, no emoji, no bold, no bullet lists, no numbered lists.

Hard rules specific to the two organic comments:
- The organic comments must NOT mention the brand, the brand's product names, or competitors by name. Keep them about the situation.

Output JSON only, matching this schema exactly:
{"organic_1": "<comment 1 — plain text>", "organic_2": "<comment 2 — plain text>", "plug": "<comment 3 with single casual brand mention — plain text>"}`;

function buildClientContext(client: SeedClient): string[] {
  const p = client.profile;
  const parts: string[] = [
    `Brand: ${client.name}`,
    `URL: ${client.url}`,
  ];
  if (p?.summary) parts.push(`What they do: ${p.summary}`);
  else if (client.description) parts.push(`What they do: ${client.description}`);
  if (p?.industry) parts.push(`Industry: ${p.industry}`);
  if (p?.audience) parts.push(`Audience: ${p.audience}`);
  if (p?.tone) parts.push(`Brand tone reference: ${p.tone}`);
  if (p?.pain_points?.length)
    parts.push(`Customer pain points: ${p.pain_points.join("; ")}`);
  if (p?.value_props?.length)
    parts.push(`Differentiators (use sparingly, only in plug comment): ${p.value_props.join("; ")}`);
  return parts;
}

export async function generateSeedPost(input: {
  client: SeedClient;
  subreddit: string;
}): Promise<SeedPostDraft> {
  const userParts = [
    ...buildClientContext(input.client),
    "",
    `Target subreddit: r/${input.subreddit}`,
    "",
    "Write a post for this subreddit that plants a discussion in the brand's niche WITHOUT mentioning the brand. The post should fit the sub naturally and invite responses.",
  ];

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: POST_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Seed post parse failed: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as { title?: string; body?: string };
  if (!parsed.title || !parsed.body) {
    throw new Error(`Seed post missing fields: ${text.slice(0, 200)}`);
  }
  return {
    title: sanitizeComment(parsed.title),
    body: sanitizeComment(parsed.body),
  };
}

export async function generateSeedComments(input: {
  client: SeedClient;
  subreddit: string;
  post: SeedPostDraft;
}): Promise<SeedCommentBundle> {
  const userParts = [
    ...buildClientContext(input.client),
    "",
    `Target subreddit: r/${input.subreddit}`,
    "",
    `The planted post (already written, do not modify):`,
    `Title: ${input.post.title}`,
    `Body: ${input.post.body}`,
    "",
    `Write three candidate comments. Two organic (no brand mention). One that sounds organic but ends with a casual brand mention.`,
  ];

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: [
      {
        type: "text",
        text: COMMENTS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Seed comments parse failed: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as {
    organic_1?: string;
    organic_2?: string;
    plug?: string;
  };
  if (!parsed.organic_1 || !parsed.organic_2 || !parsed.plug) {
    throw new Error(`Seed comments missing fields: ${text.slice(0, 200)}`);
  }
  return {
    organic_1: sanitizeComment(parsed.organic_1),
    organic_2: sanitizeComment(parsed.organic_2),
    plug: sanitizeComment(parsed.plug),
  };
}
