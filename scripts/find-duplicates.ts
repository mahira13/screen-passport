// Lists locations that are probably the same physical place (same name and city, or within 30 m).
// Usage: npm run duplicates                          (prints groups, changes nothing)
//        npm run duplicates -- --apply 32:55,63 45:58 (merge 55 and 63 into 32, and 58 into 45)
// Merging moves every title onto the kept row, marks the others rejected (never deleted) and
// remaps saved trips and passports to the kept id. Needs migration 007.
import { config } from "dotenv";
import { duplicateGroups } from "../lib/duplicates";
import { supabaseAdmin } from "../lib/supabase";

config({ path: ".env.local" });

function parseApply(args: string[]): { keep: number; drop: number[] }[] | null {
  const i = args.indexOf("--apply");
  if (i === -1) return null;
  return args.slice(i + 1).map((pair) => {
    const m = /^(\d+):(\d+(?:,\d+)*)$/.exec(pair);
    if (!m) throw new Error(`Bad merge "${pair}". Use keep:drop,drop, e.g. 32:55,63`);
    return { keep: Number(m[1]), drop: m[2].split(",").map(Number) };
  });
}

async function main() {
  const merges = parseApply(process.argv.slice(2));
  const db = supabaseAdmin();

  if (merges) {
    for (const { keep, drop } of merges) {
      const { error } = await db.rpc("merge_locations", { p_keep: keep, p_drop: drop });
      if (error) throw new Error(`merge ${keep}:${drop.join(",")}: ${error.message}`);
      console.log(`Merged ${drop.join(", ")} into ${keep}.`);
    }
    return;
  }

  const { data, error } = await db
    .from("locations")
    .select("id, name, city, lat, lng")
    .is("merged_into", null)
    .neq("verification_status", "rejected")
    .order("id");
  if (error) throw new Error(error.message);
  const groups = duplicateGroups(data);
  if (groups.length === 0) return console.log("No likely duplicates.");
  for (const g of groups) {
    console.log(`${g.ids.join(", ")}  (${g.reason})`);
    g.ids.forEach((id, k) => console.log(`   ${id}  ${g.names[k]}`));
  }
  console.log("\nCheck each group, then merge with: npm run duplicates -- --apply keep:drop,drop");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
