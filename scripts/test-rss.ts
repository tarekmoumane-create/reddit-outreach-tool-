import { fetchRedditSearch } from "../src/lib/reddit/rss";

async function main() {
  const q = process.argv[2] ?? "productivity";
  const window = (process.argv[3] ?? "day") as "hour" | "day" | "week";
  console.log(`Query: "${q}" (window=${window})`);
  const posts = await fetchRedditSearch(q, { limit: 10, window });
  console.log(`Fetched: ${posts.length}`);
  for (const p of posts) {
    console.log(
      `- [${p.subreddit}] ${p.title.slice(0, 90)}  (${p.reddit_post_id})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
