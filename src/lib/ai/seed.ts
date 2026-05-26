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

export type SeedStyle = "organic" | "brand_led";

export type SeedPostDraft = {
  title: string;
  body: string;
};

export type SeedCommentBundle = {
  organic_1: string;
  organic_2: string;
  plug: string;
};

// =============================================================================
// ORGANIC STYLE — the post plants a topic, the brand mention rides in via the
// third comment. This is the original behavior.
// =============================================================================

const POST_ORGANIC_SYSTEM_PROMPT = `You are writing a Reddit post for a content-seeding campaign. The post itself must NOT mention or hint at any specific brand. It should read as if a real person, on their phone, opened a subreddit and posted a question or short story or take that fits naturally there. Plant the topic; the brand mention will happen later in a comment, not here.

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

const COMMENTS_ORGANIC_SYSTEM_PROMPT = `You are writing three candidate comments for a Reddit post that we ourselves planted. Two must be fully organic (no brand mention at all). The third must sound just as organic but include a casual, off-hand mention of the brand, like a real person briefly recommending what worked for them.

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

// =============================================================================
// BRAND-LED STYLE — the post IS about the brand. Honest-review / open
// question / discovery story. Comments support, question, and gently nuance
// so the thread reads like organic engagement.
// =============================================================================

const POST_BRAND_LED_SYSTEM_PROMPT = `You are writing a Reddit post that is openly about a specific brand. The post should read as if a real customer (or a curious would-be customer) sat down to share an honest take, ask the community about the brand, or compare notes. This is NOT marketing copy. It's one human posting to a subreddit they hang out in.

Pick the archetype that best fits the brand and subreddit:
- HONEST REVIEW: "i've been using {brand} for [N weeks/months], here's what i actually think". Include at least one minor downside or "what could be better" so it reads honest.
- OPEN QUESTION: "anyone here tried {brand}? worth it or hype?" or "thinking about pulling the trigger on {brand}, would love to hear from people who've actually used it"
- DISCOVERY/SWITCH STORY: "switched to {brand} from [generic category, no competitor name], here's what changed"
- SPECIFIC USE CASE: "using {brand} for [specific situation], curious how others handle X"
- N-MONTHS-IN UPDATE: "[N] months in with {brand}, here's where i've landed"

Voice and structure:
- First person. Casual. Match the subreddit's tone (most lean lowercase, conversational; niche/professional subs are tighter).
- Title: how a real user would phrase it. 60-120 chars. Mention the brand by name in the title.
- Body: 3-7 sentences. Concrete details: specific use case, specific time period, specific aspect they liked or didn't. End with an open question or "curious what others think" to invite replies.
- Mention the brand by name once or twice in the body, naturally. Don't repeat it every sentence.
- AT LEAST ONE small downside, mixed feeling, or honest caveat. Real posts are never 100% positive — pure raves get downvoted as shilling.

ABSOLUTELY NO em dashes (—) or en dashes (–). Use commas, periods, or two sentences.

Other AI tells to avoid:
- Smart/curly quotes. Use straight quotes only.
- Marketing language: "game changer", "revolutionary", "next-level", "powerful", "comprehensive", "robust", "seamless", "transform", "elevate", "unlock".
- Throat-clearing openers: "Honestly,", "Look,", "So,", "Alright,", "I get it,".
- Tricolons and balanced parallel structures.
- Pure superlatives. "amazing", "incredible", "best thing ever" without specifics reads as fake.
- Polished structure. Real posts ramble a little, use fragments, leave threads dangling.

Hard rules:
- Do NOT name specific competitor brands. You may refer to a general category ("the bigger names", "what i was using before", "the usual suspects") but never name them.
- Do NOT include URLs or pricing copied from marketing materials.
- Do NOT use phrases like "I've been loving" or "obsessed with" — too influencer-coded.
- Do NOT end with a CTA or anything that reads as conversion copy.
- No headings, no emoji, no bold, no bullet/numbered lists.

Output JSON only, matching this schema exactly:
{"title": "<post title mentioning the brand — plain text, no em dashes>", "body": "<post body — plain text, no em dashes>"}`;

const COMMENTS_BRAND_LED_SYSTEM_PROMPT = `You are writing three candidate comments for a Reddit post we planted that is openly about a specific brand. The poster is "us" but the COMMENTERS need to look like three different real people stumbling into the thread. The goal is to make the post look like it sparked authentic engagement — not to pitch the brand again.

Each comment plays a different role:
1. SUPPORTIVE SAME-EXPERIENCE — "yeah i've used {brand} too, agree with you on [specific thing OP mentioned]". Names the brand once, briefly, in passing. Adds one new concrete detail OP didn't mention.
2. ENGAGEMENT QUESTION — asks OP a specific follow-up question to keep the thread alive. May mention the brand by name but doesn't have to. Should sound like genuine curiosity, e.g. "how long before you noticed X?" or "did you try [specific feature/variant]?"
3. LIGHT NUANCE OR ALTERNATIVE — gentle pushback, mixed feelings, or "i went with [generic category, no brand name] first and then tried {brand}". Optionally mentions the brand once. Must NOT trash the brand — just adds texture so the thread doesn't look one-sided.

All three must read as if real humans on their phones wrote them. If any one looks AI-generated, you have failed.

Voice and structure for ALL three:
- First person. Casual. Match the subreddit's tone.
- 2-5 sentences each. Lowercase where it reads more natural. Fragments are fine.
- Vary opener, sentence length, and energy across the three. Three different people, three different vibes.
- Lead with a real reaction to OP's specific post, not a generic statement.

ABSOLUTELY NO em dashes (—) or en dashes (–). Use commas, periods, or two sentences.

Other AI tells to avoid in all three:
- Smart/curly quotes. Use straight quotes only.
- Marketing language: "game changer", "revolutionary", "next-level", "powerful", "comprehensive", "seamless", "transform".
- Throat-clearing openers: "Honestly,", "Look,", "Just to add,", "It's worth noting,", "Ultimately,".
- Tricolons and balanced parallel structures.
- Banned phrases: "check out", "highly recommend", "must-try", "you should try", "can't recommend enough".
- Polished structure. Real comments are messy.

Hard rules for ALL three:
- Do NOT start with "Hey", "Hi", "Hi there", or any greeting.
- Do NOT name specific competitor brands. Generic category words only ("the bigger names", "what i was using before").
- No URLs. No headings, no emoji, no bold, no bullet/numbered lists.
- Use the brand name lowercased unless that would look genuinely wrong.

Output JSON only, matching this schema exactly:
{"organic_1": "<supportive same-experience comment — plain text>", "organic_2": "<engagement question comment — plain text>", "plug": "<light nuance or alternative comment — plain text>"}`;

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
  style?: SeedStyle;
}): Promise<SeedPostDraft> {
  const style: SeedStyle = input.style ?? "organic";
  const systemPrompt =
    style === "brand_led"
      ? POST_BRAND_LED_SYSTEM_PROMPT
      : POST_ORGANIC_SYSTEM_PROMPT;

  const userParts = [
    ...buildClientContext(input.client),
    "",
    `Target subreddit: r/${input.subreddit}`,
    "",
    style === "brand_led"
      ? `Write a post that is openly about ${input.client.name}, in the voice of a real customer or curious would-be customer. Pick the archetype that fits this subreddit. Mention the brand by name in the title and once or twice in the body. Include at least one small downside or honest caveat. End with an open question that invites replies.`
      : "Write a post for this subreddit that plants a discussion in the brand's niche WITHOUT mentioning the brand. The post should fit the sub naturally and invite responses.",
  ];

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPrompt,
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
  style?: SeedStyle;
}): Promise<SeedCommentBundle> {
  const style: SeedStyle = input.style ?? "organic";
  const systemPrompt =
    style === "brand_led"
      ? COMMENTS_BRAND_LED_SYSTEM_PROMPT
      : COMMENTS_ORGANIC_SYSTEM_PROMPT;

  const userParts = [
    ...buildClientContext(input.client),
    "",
    `Target subreddit: r/${input.subreddit}`,
    "",
    `The planted post (already written, do not modify):`,
    `Title: ${input.post.title}`,
    `Body: ${input.post.body}`,
    "",
    style === "brand_led"
      ? `Write three candidate comments playing the three roles in your system prompt: supportive same-experience, engagement question, light nuance/alternative. The post mentions ${input.client.name} openly, so commenters can reference the brand naturally without it reading as shilling.`
      : `Write three candidate comments. Two organic (no brand mention). One that sounds organic but ends with a casual brand mention.`,
  ];

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: [
      {
        type: "text",
        text: systemPrompt,
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
