export * from "../server/ai-provider.mjs";

export default function handler(req, res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "not_found" }));
}
