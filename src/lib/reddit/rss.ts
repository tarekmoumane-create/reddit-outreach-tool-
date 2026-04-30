import { XMLParser } from "fast-xml-parser";

export type RedditPost = {
  reddit_post_id: string;
  title: string;
  subreddit: string;
  permalink: string;
  post_date: string;
  author: string | null;
  summary: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const USER_AGENT = "reddit-outreach-tool/1.0";

export async function fetchRedditSearch(
  query: string,
  opts: {
    limit?: number;
    window?: "hour" | "day" | "week";
    subreddit?: string;
  } = {},
): Promise<RedditPost[]> {
  const limit = opts.limit ?? 25;
  const window = opts.window ?? "day";
  const base = opts.subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(opts.subreddit)}/search.rss`
    : `https://www.reddit.com/search.rss`;
  const restrict = opts.subreddit ? `&restrict_sr=1` : "";
  const url =
    `${base}?q=${encodeURIComponent(query)}` +
    `&sort=new&t=${window}&limit=${limit}${restrict}`;

  return parseAtomFeed(await fetchXml(url));
}

export async function fetchSubredditNew(
  subreddit: string,
  opts: { limit?: number } = {},
): Promise<RedditPost[]> {
  const limit = opts.limit ?? 10;
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.rss?limit=${limit}`;
  return parseAtomFeed(await fetchXml(url));
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/atom+xml" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Reddit RSS fetch failed: ${res.status} ${res.statusText} (${url})`,
    );
  }
  return res.text();
}

function parseAtomFeed(xml: string): RedditPost[] {
  const parsed = parser.parse(xml);
  const raw = parsed?.feed?.entry;
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];

  const posts: RedditPost[] = [];
  for (const entry of entries) {
    const permalink = extractPermalink(entry);
    const id = extractPostId(permalink);
    if (!id) continue;
    const title = textOf(entry.title) ?? "";
    const summary = cleanPostBody(textOf(entry.content));
    const subreddit = extractSubreddit(permalink) ?? "";
    const author =
      typeof entry.author === "object" && entry.author?.name
        ? String(entry.author.name)
        : null;
    const post_date =
      typeof entry.published === "string"
        ? entry.published
        : typeof entry.updated === "string"
          ? entry.updated
          : new Date().toISOString();

    posts.push({
      reddit_post_id: id,
      title,
      subreddit,
      permalink,
      post_date,
      author,
      summary,
    });
  }
  return posts;
}

// Reddit RSS wraps the actual post body in `<!-- SC_OFF --> ... <!-- SC_ON -->`
// markers, with HTML-entity-encoded HTML, followed by a "submitted by ... to ..."
// footer and [link]/[comments] markers. Pull out just the body text.
function cleanPostBody(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw
    .replace(/&#32;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  const body = s.match(/<!--\s*SC_OFF\s*-->([\s\S]*?)<!--\s*SC_ON\s*-->/);
  if (body) s = body[1];
  s = s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*submitted by\s+\/u\/[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

type AtomEntry = {
  title?: string | { "#text"?: string };
  content?: string | { "#text"?: string };
  author?: { name?: string };
  published?: string;
  updated?: string;
  link?:
    | string
    | { "@_href"?: string; "@_rel"?: string }
    | Array<{ "@_href"?: string; "@_rel"?: string }>;
};

function textOf(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "#text" in v) {
    const t = (v as { "#text"?: unknown })["#text"];
    return typeof t === "string" ? t : null;
  }
  return null;
}

function extractPermalink(entry: AtomEntry): string {
  const link = entry.link;
  if (Array.isArray(link)) {
    const alt = link.find((l) => l["@_rel"] === "alternate") ?? link[0];
    return alt?.["@_href"] ?? "";
  }
  if (typeof link === "object" && link) return link["@_href"] ?? "";
  if (typeof link === "string") return link;
  return "";
}

function extractPostId(permalink: string): string | null {
  const m = permalink.match(/\/comments\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

function extractSubreddit(permalink: string): string | null {
  const m = permalink.match(/\/r\/([^/]+)\//i);
  return m ? m[1] : null;
}
