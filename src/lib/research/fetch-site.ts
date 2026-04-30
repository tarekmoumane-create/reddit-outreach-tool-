const USER_AGENT = "reddit-outreach-tool/1.0 (research bot)";

// Pages we'll try to grab in addition to the homepage, in priority order.
const CANDIDATE_PATHS = [
  "about",
  "about-us",
  "services",
  "products",
  "how-it-works",
  "pricing",
  "features",
  "solutions",
  "company",
  "what-we-do",
];

const MAX_EXTRA_PAGES = 5;
const PER_PAGE_CHAR_CAP = 2500;
const TOTAL_CHAR_CAP = 12000;

export async function fetchSiteContext(url: string): Promise<string> {
  const base = new URL(url);
  const homepageHtml = await tryFetchHtml(base.toString());
  if (!homepageHtml) {
    throw new Error(`Could not fetch homepage: ${url}`);
  }

  const pages: { url: string; text: string }[] = [
    {
      url: base.toString(),
      text: htmlToText(homepageHtml).slice(0, PER_PAGE_CHAR_CAP),
    },
  ];

  // Collect candidate URLs: known paths + internal links from the homepage.
  const tried = new Set<string>([base.toString()]);
  const queue: string[] = [];
  for (const path of CANDIDATE_PATHS) {
    queue.push(new URL(`/${path}`, base).toString());
  }
  for (const href of extractInternalLinks(homepageHtml, base)) {
    queue.push(href);
  }

  for (const next of queue) {
    if (pages.length - 1 >= MAX_EXTRA_PAGES) break;
    if (tried.has(next)) continue;
    tried.add(next);
    const html = await tryFetchHtml(next);
    if (!html) continue;
    const text = htmlToText(html).trim();
    if (text.length < 200) continue;
    pages.push({ url: next, text: text.slice(0, PER_PAGE_CHAR_CAP) });
  }

  const combined = pages
    .map((p) => `--- PAGE: ${p.url} ---\n${p.text}`)
    .join("\n\n");
  return combined.slice(0, TOTAL_CHAR_CAP);
}

async function tryFetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function firstMatch(html: string, re: RegExp): string {
  return html.match(re)?.[1]?.trim() ?? "";
}

function htmlToText(html: string): string {
  const title = firstMatch(html, /<title[^>]*>([^<]*)<\/title>/i);
  const metaDesc = firstMatch(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogTitle = firstMatch(
    html,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogDesc = firstMatch(
    html,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  );

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  const lines: string[] = [];
  if (title) lines.push(`TITLE: ${title}`);
  if (metaDesc) lines.push(`META_DESC: ${metaDesc}`);
  if (ogTitle) lines.push(`OG_TITLE: ${ogTitle}`);
  if (ogDesc) lines.push(`OG_DESC: ${ogDesc}`);
  lines.push("", "BODY:", body);
  return lines.join("\n");
}

function extractInternalLinks(html: string, base: URL): string[] {
  const hrefs = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:")) continue;
    try {
      const abs = new URL(raw, base);
      if (abs.hostname !== base.hostname) continue;
      // Skip obvious junk (file downloads, assets, legal).
      if (
        /\.(pdf|png|jpg|jpeg|gif|svg|zip|mp4|webm|css|js)(\?|$)/i.test(
          abs.pathname,
        )
      )
        continue;
      if (/privacy|terms|cookie|legal/i.test(abs.pathname)) continue;
      hrefs.add(abs.toString());
    } catch {
      /* ignore */
    }
  }
  return [...hrefs].slice(0, 15);
}
