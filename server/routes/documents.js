import { Router } from "express";
import multer from "multer";
import { ai, MODEL } from "../lib/claude.js";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { generate, aiLimiter } from "../lib/gemini.js";
const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const PROMPT = `You are reading a purchase invoice for a college. It may list MANY items.
Return ONLY a JSON object in this shape:
{"vendor":"","purchase_date":"YYYY-MM-DD","warranty_months":0,
 "items":[{"asset_type":"","description":"","quantity":1,"unit_cost":0,"serial_numbers":[]}]}
Rules:
- Include EVERY line item that is a physical asset (computers, laptops, projectors, printers, switches, lab equipment). Skip shipping, installation, tax and service lines.
- quantity is the number of units on that line.
- unit_cost is the price of ONE unit in rupees as a plain number, before GST if shown separately.
- serial_numbers lists every serial number printed for that line. Use [] if none are printed. Never invent serials.
- asset_type is a short name like "Desktop Computer" or "Laptop". Put the model in description.
- purchase_date is the invoice date. warranty_months is a number (2 years = 24), or null if not stated.
- Use "" for unknown text and null for unknown numbers.`;

// ---------- Upload + extract ----------
router.post("/extract", requireRole("admin"), aiLimiter, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  if (!ALLOWED.includes(file.mimetype))
    return res.status(400).json({ error: "Upload a PDF, PNG, JPG or WEBP file" });

  // 1. Store the original file
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `invoices/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("documents").upload(path, file.buffer, { contentType: file.mimetype });
  if (upErr) return res.status(500).json({ error: "Storage upload failed: " + upErr.message });

  // 2. Ask Gemini to read it
  try {
    const response = await generate({
      
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: file.mimetype, data: file.buffer.toString("base64") } },
          { text: PROMPT },
        ],
      }],
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });

    const raw = (response.text ?? "").replace(/```json|```/g, "").trim();
    const extracted = JSON.parse(raw);
    res.json({ extracted, file_path: path, file_name: file.originalname });
  } catch (e) {
    console.error("Extraction error:", e.message);
    const busy = /429|quota|RESOURCE_EXHAUSTED/i.test(e.message);
    // The file is saved, so the admin can still fill the form by hand
    res.status(busy ? 429 : 502).json({
      error: busy ? "Free-tier rate limit reached. Wait a minute and retry." : "Could not read the invoice. Fill the form manually.",
      file_path: path, file_name: file.originalname,
    });
  }
});

// ---------- Temporary download link for a stored document ----------
router.get("/:id/url", requireRole("admin", "faculty"), async (req, res) => {
  const { data: doc } = await supabase.from("documents").select("file_url").eq("id", req.params.id).maybeSingle();
  if (!doc) return res.status(404).json({ error: "Document not found" });
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 300);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ url: data.signedUrl });
});

export default router;