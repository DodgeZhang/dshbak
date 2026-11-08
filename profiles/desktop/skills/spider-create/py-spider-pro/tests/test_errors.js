/**
 * py-spider-pro 错误处理模块测试 v3.0
 */
import { describe, it, expect } from "vitest";
import {
  SpiderError,
  ValidationError,
  NetworkError,
  CloudflareError,
  TimeoutError,
  ParseError,
  FileError,
  CacheError,
  AnalysisError,
  GenerationError
} from "../lib/errors.js";

describe("错误类型测试", () => {
  it("SpiderError 基础错误类", () => {
    const error = new SpiderError("测试错误", "TEST_ERROR", { key: "value" });
    expect(error.message).toBe("测试错误");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.details).toEqual({ key: "value" });
    expect(error.name).toBe("SpiderError");
  });

  it("ValidationError 参数验证错误", () => {
    const error = new ValidationError("参数无效", "username");
    expect(error.message).toBe("参数无效");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details.field).toBe("username");
  });

  it("NetworkError 网络错误", () => {
    const error = new NetworkError("网络超时", "https://example.com");
    expect(error.message).toBe("网络超时");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.details.url).toBe("https://example.com");
  });

  it("CloudflareError Cloudflare错误", () => {
    const error = new CloudflareError("Cloudflare挑战", "https://example.com");
    expect(error.message).toBe("Cloudflare挑战");
    expect(error.code).toBe("CLOUDFLARE_ERROR");
    expect(error.toResponse().content[0].text).toContain("💡 提示");
  });

  it("TimeoutError 超时错误", () => {
    const error = new TimeoutError("请求超时", "fetchPage");
    expect(error.message).toBe("请求超时");
    expect(error.code).toBe("TIMEOUT_ERROR");
    expect(error.details.operation).toBe("fetchPage");
    expect(error.toResponse().content[0].text).toContain("⏰");
  });

  it("ParseError 解析错误", () => {
    const error = new ParseError("HTML解析失败", "homeContent");
    expect(error.message).toBe("HTML解析失败");
    expect(error.code).toBe("PARSE_ERROR");
    expect(error.details.source).toBe("homeContent");
  });

  it("FileError 文件错误", () => {
    const error = new FileError("写入失败", "/path/to/file");
    expect(error.message).toBe("写入失败");
    expect(error.code).toBe("FILE_ERROR");
    expect(error.details.filePath).toBe("/path/to/file");
  });

  it("CacheError 缓存错误", () => {
    const error = new CacheError("缓存读取失败");
    expect(error.message).toBe("缓存读取失败");
    expect(error.code).toBe("CACHE_ERROR");
  });

  it("AnalysisError 分析错误", () => {
    const error = new AnalysisError("分析失败", "https://example.com", "detectCMS");
    expect(error.message).toBe("分析失败");
    expect(error.code).toBe("ANALYSIS_ERROR");
    expect(error.details.url).toBe("https://example.com");
    expect(error.details.stage).toBe("detectCMS");
  });

  it("GenerationError 生成错误", () => {
    const error = new GenerationError("模板未找到", "unknown_cms");
    expect(error.message).toBe("模板未找到");
    expect(error.code).toBe("GENERATION_ERROR");
    expect(error.details.cmsType).toBe("unknown_cms");
  });
});

describe("错误响应格式测试", () => {
  it("基础错误响应格式", () => {
    const error = new SpiderError("测试错误");
    const response = error.toResponse();
    expect(response.content[0].type).toBe("text");
    expect(response.content[0].text).toContain("❌");
    expect(response.content[0].text).toContain("[SPIDER_ERROR]");
    expect(response.content[0].text).toContain("测试错误");
  });

  it("错误时间戳存在", () => {
    const error = new SpiderError("测试");
    expect(error.timestamp).toBeDefined();
    expect(new Date(error.timestamp).toISOString()).toBe(error.timestamp);
  });
});