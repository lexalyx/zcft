import { describe, expect, it } from "vitest";
import { renderRichText } from "../src/lib/markdown";

describe("renderRichText", () => {
  it("thoát HTML trước khi định dạng", () => {
    const html = renderRichText('<img src=x onerror="alert(1)"> **đậm**');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<strong>đậm</strong>");
  });

  it("chỉ đánh dấu mã căn cứ có trong bài, nội dung chú thích cũng được thoát", () => {
    const html = renderRichText("Theo [A] và [Z]", new Map([["A", 'Điều "1" <b>']]));
    expect(html).toContain('<span class="cite" title="Điều &quot;1&quot; &lt;b&gt;">A</span>');
    expect(html).toContain("[Z]");
  });

  it("đoạn văn và danh sách", () => {
    expect(renderRichText("Một\n\n- a\n- b")).toBe("<p>Một</p><ul><li>a</li><li>b</li></ul>");
  });
});
