export function inferTargetRole(jd: string): string {
  const lines = jd.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    const match = line.match(/(?:岗位|职位|招聘岗位|职位名称|岗位名称)\s*[：:]\s*(.+)/);
    if (match?.[1]) return match[1].trim().slice(0, 36);
  }
  const first = lines[0] || "";
  if (first.length >= 2 && first.length <= 28 && !/[。；]/.test(first)) return first;
  return "目标岗位";
}
