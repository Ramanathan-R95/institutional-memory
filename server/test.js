import { supabase } from "./lib/supabase.js";

const { data, error } = await supabase.from("profiles").select("*");
console.log(error ?? data);