import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./research";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ScoreInput = {
  client: {
    name: string;
    url: string;
    description: string | null;
    extra_keywords: string[];
    profile?: BrandProfile | null;
  };
  post: {
    title: string;
    subreddit: string;
    summary: string | null;
  };
};

export type ScoreResult = {
  score: number;
  why_it_fits: string;
};

const SYSTEM_PROMPT = `You evaluate Reddit posts as outreach opportunities for a brand. Your task is to recognize whether a thoughtful customer of this brand would naturally feel inclined to chime in with a helpful, on-topic reply.

GUIDING PRINCIPLE: be generous. The cost of letting a borderline post through is low — the operator can ignore it. The cost of missing a real opportunity is high — that's a lost connection. When in genuine doubt between two bands, pick the higher one.

A high score does NOT require:
- The post to name the brand
- The post to name a competitor
- The post to use the brand's exact pain-point vocabulary

A high score DOES require:
- The poster being plausibly in the brand's audience
- The topic touching the brand's category, even loosely
- A reply mentioning the brand could feel natural and welcome (not forced)

Score bands (0-100):

90-100 · DIRECT FIT
Post asks for recommendations in the brand's exact category, names a competitor, or describes a pain point that almost paraphrases the brand's value prop. Buying intent is explicit.

70-89 · STRONG FIT
Post is clearly in the brand's general space and shows authentic interest, struggle, or curiosity. Pain point is implied even if not stated in the brand's exact words. A customer of this brand would have something genuinely useful to share here.

50-69 · PLAUSIBLE FIT
Post is adjacent to the brand's space — same audience, related topic. A thoughtful comment from a customer could land naturally without feeling forced. Connection requires one small inferential step. Most "good but not perfect" opportunities live here.

30-49 · WEAK FIT
Tangentially related. Audience matches but topic is off, or topic matches but audience is wrong. A reply would have to stretch to feel relevant.

Below 30 · NOT A FIT
Wrong audience entirely, off-topic showcase / meme / joke without an ask, poster is a vendor pitching their own product, or question is already answered with consensus.

BOOST signals (raise the score when you see these):
- Names a competitor or describes a competitor's product, even imprecisely
- Asks "what's the best ___" / "any recommendations for ___" / "anyone tried ___"
- Describes a listed pain point — OR uses common customer language for that pain (e.g. for a yerba mate brand: "coffee crashes", "feeling jittery", "want clean energy", "afternoon slump")
- Audience demographic matches and the broader category is mentioned
- Phrasing suggests openness ("looking for", "thinking about switching", "tired of", "anyone else feel like…")
- Post is venting about a current option not working

REDUCE signals (lower the score):
- Poster is selling, advertising, or pitching their own product
- Question is already resolved with strong consensus in comments
- Off-topic memes, jokes, showcases without an ask
- Poster is a creator, vendor, or industry professional discussing their work, not a customer
- Reply would feel salesy, opportunistic, or out of character for the sub

Output JSON only, matching this schema exactly:
{"score": <integer 0-100>, "why_it_fits": "<one sentence naming the specific signal(s) that drove the score>"}`;

export async function scorePost(input: ScoreInput): Promise<ScoreResult> {
  const p = input.client.profile;
  const userParts: string[] = [
    `Brand: ${input.client.name}`,
    `URL: ${input.client.url}`,
  ];
  if (p?.summary) userParts.push(`What they do: ${p.summary}`);
  else if (input.client.description)
    userParts.push(`What they do: ${input.client.description}`);

  if (p?.industry) userParts.push(`Industry: ${p.industry}`);
  if (p?.audience) userParts.push(`Audience: ${p.audience}`);
  if (p?.pain_points?.length)
    userParts.push(`Pain points solved: ${p.pain_points.join("; ")}`);
  if (p?.value_props?.length)
    userParts.push(`Value props: ${p.value_props.join("; ")}`);
  if (p?.competitors?.length)
    userParts.push(
      `Competitors (mentions of these are strong signals): ${p.competitors.join("; ")}`,
    );
  if (input.client.extra_keywords.length)
    userParts.push(
      `Operator-added keywords: ${input.client.extra_keywords.join(", ")}`,
    );

  userParts.push(
    "",
    `Reddit post:`,
    `- Subreddit: r/${input.post.subreddit}`,
    `- Title: ${input.post.title}`,
  );
  if (input.post.summary)
    userParts.push(`- Body: ${input.post.summary.slice(0, 1500)}`);

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
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
    throw new Error(`Score parse failed: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as Partial<ScoreResult>;
  if (typeof parsed.score !== "number") {
    throw new Error(`Score missing: ${text.slice(0, 200)}`);
  }
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    why_it_fits: parsed.why_it_fits ?? "",
  };
}
