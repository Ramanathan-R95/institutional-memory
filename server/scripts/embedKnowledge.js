import { supabase } from "../lib/supabase.js";
import { embedMany, itemText } from "../lib/embed.js";

const { data: items, error } = await supabase
  .from("knowledge_items").select("id, kind, title, content").is("embedding", null);
if (error) { console.error(error.message); process.exit(1); }
if (!items.length) { console.log("Nothing to embed."); process.exit(0); }

console.log(`Embedding ${items.length} items...`);
const vectors = await embedMany(items.map(itemText));

for (let i = 0; i < items.length; i++) {
  const { error: e } = await supabase.from("knowledge_items").update({ embedding: vectors[i] }).eq("id", items[i].id);
  if (e) { console.error(`✗ ${items[i].title}:`, e.message); process.exit(1); }
  console.log(`✓ ${items[i].title}`);
}
console.log("Done.");