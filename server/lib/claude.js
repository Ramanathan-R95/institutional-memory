import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";