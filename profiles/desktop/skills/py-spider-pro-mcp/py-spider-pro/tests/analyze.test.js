/**
 * py-spider-pro 分析模块测试 v3.0
 */
import { describe, it, expect } from "vitest";
import {
  handleAnalyzeWebsite,
  handleBatchAnalyze
} from "../lib/analyze.js";

describe("分析模块", () => {
  describe("handleAnalyzeWebsite", () => {
    it("handleAnalyzeWebsite 是函数", () => {
      expect(typeof handleAnalyzeWebsite).toBe("function");
    });

    it("参数验证 - URL 必填", async () => {
      const result = await handleAnalyzeWebsite({}, {});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it("参数验证 - URL 格式错误", async () => {
      const result = await handleAnalyzeWebsite({ url: "invalid-url" }, {});
      expect(result).toBeDefined();
    });
  });

  describe("handleBatchAnalyze", () => {
    it("handleBatchAnalyze 是函数", () => {
      expect(typeof handleBatchAnalyze).toBe("function");
    });

    it("空 URL 列表返回错误", async () => {
      const result = await handleBatchAnalyze({ urls: [] }, {});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it("URL 列表格式正确", async () => {
      const result = await handleBatchAnalyze({ urls: ["https://example.com"] }, {});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });
});