/**
 * py-spider-pro 爬虫工具模块测试 v3.0
 */
import { describe, it, expect } from "vitest";
import {
  handleAnalyzeWebsite,
  handleBatchAnalyze,
  handleOneClickSpider,
  handleSpiderTest,
  handleExtractLinks,
  handleShowHistory,
  handleClearHistory
} from "../lib/spider_tools.js";

describe("爬虫工具模块", () => {
  describe("handleAnalyzeWebsite", () => {
    it("handleAnalyzeWebsite 是函数", () => {
      expect(typeof handleAnalyzeWebsite).toBe("function");
    });
  });

  describe("handleBatchAnalyze", () => {
    it("handleBatchAnalyze 是函数", () => {
      expect(typeof handleBatchAnalyze).toBe("function");
    });
  });

  describe("handleOneClickSpider", () => {
    it("handleOneClickSpider 是函数", () => {
      expect(typeof handleOneClickSpider).toBe("function");
    });
  });

  describe("handleSpiderTest", () => {
    it("handleSpiderTest 是函数", () => {
      expect(typeof handleSpiderTest).toBe("function");
    });

    it("handleSpiderTest 返回对象包含 content 字段", () => {
      const result = handleSpiderTest({ code: "def test():\n    pass" });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe("handleExtractLinks", () => {
    it("handleExtractLinks 是函数", () => {
      expect(typeof handleExtractLinks).toBe("function");
    });
  });

  describe("handleShowHistory", () => {
    it("handleShowHistory 是函数", () => {
      expect(typeof handleShowHistory).toBe("function");
    });

    it("handleShowHistory 返回对象包含 content 字段", () => {
      const result = handleShowHistory({});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe("handleClearHistory", () => {
    it("handleClearHistory 是函数", () => {
      expect(typeof handleClearHistory).toBe("function");
    });

    it("handleClearHistory 返回对象包含 content 字段", () => {
      const result = handleClearHistory();
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });
});