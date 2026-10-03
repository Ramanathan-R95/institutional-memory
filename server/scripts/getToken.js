import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await sb.auth.signInWithPassword({
  email: process.argv[2] ?? "admin@demo.com",
  password: "Demo@1234",
});
console.log(error ? error.message : data.session.access_token);