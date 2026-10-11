/**
 * Hiển thị văn bản do Gemini trả về một cách an toàn: thoát toàn bộ HTML trước,
 * rồi chỉ thêm đậm/nghiêng, danh sách, xuống dòng và đánh dấu mã căn cứ [ID] có trong bài.
 */

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** @param citations mã căn cứ -> nội dung (hiện khi rê chuột) */
export function renderRichText(text: string, citations: Map<string, string> = new Map()): string {
  const inline = (line: string) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/\[([A-Za-z0-9_.-]+)\]/g, (match, id: string) => {
        const title = citations.get(id);
        return title === undefined ? match : `<span class="cite" title="${escapeHtml(title)}">${id}</span>`;
      });
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length && lines.every((l) => /^[-*•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
}
