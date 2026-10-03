// Strips characters that have special meaning inside PostgREST .or() filters
export const likeSafe = (s) => String(s ?? "").replace(/[%_,()*\\"']/g, " ").trim().slice(0, 60);