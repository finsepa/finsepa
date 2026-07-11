import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const USER_ID = "52373158-0eff-48de-80ba-f9206ee0e52a";

const client = new pg.Client({
  connectionString: env.SUPABASE_POOLER_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const items = await client.query(
  "select count(*)::int as n from watchlist where user_id = $1",
  [USER_ID],
);
const collections = await client.query(
  "select id, name, sort_order, created_at from watchlist_collections where user_id = $1 order by sort_order",
  [USER_ID],
);
const orphanItems = await client.query(
  `select count(*)::int as n
   from watchlist w
   where w.collection_id is not null
     and not exists (
       select 1 from watchlist_collections c where c.id = w.collection_id
     )`,
);

console.log(JSON.stringify({ items: items.rows[0], collections: collections.rows, orphanItems: orphanItems.rows[0] }, null, 2));

await client.end();
