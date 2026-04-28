import { describe, it, expect } from "vitest";
import { sanitizeDraftHtml } from "./drafting.js";

describe("drafting domain", () => {
  describe("sanitizeDraftHtml", () => {
    it("preserves allowed tags and attributes", () => {
      const input = '<h1 class="title">Hello</h1><p>This is a <strong>test</strong>.</p><img src="test.png" alt="Test Image" />';
      const output = sanitizeDraftHtml(input);
      expect(output).toContain('<h1 class="title">Hello</h1>');
      expect(output).toContain("<p>This is a <strong>test</strong>.</p>");
      expect(output).toContain('<img src="test.png" alt="Test Image" />');
    });

    it("removes disallowed tags", () => {
      const input = '<script>alert("xss")</script><p>Safe content</p><iframe src="malicious.com"></iframe>';
      const output = sanitizeDraftHtml(input);
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("<iframe>");
      expect(output).toBe("<p>Safe content</p>");
    });

    it("removes disallowed attributes", () => {
      const input = '<p onclick="alert(\'xss\')">Click me</p><img src="test.png" onerror="alert(\'xss\')" />';
      const output = sanitizeDraftHtml(input);
      expect(output).not.toContain("onclick");
      expect(output).not.toContain("onerror");
      expect(output).toBe('<p>Click me</p><img src="test.png" />');
    });
  });
});
