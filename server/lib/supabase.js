import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
// console.log("SUPABASE_URL", process.env.SUPABASE_URL);
// console.log("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);