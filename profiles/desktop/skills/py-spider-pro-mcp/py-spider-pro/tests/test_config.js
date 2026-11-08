/**
 * py-spider-pro 配置模块测试 v3.0
 */
import { describe, it, expect } from "vitest";
import {
  VERSION,
  HTTP_TIMEOUT,
  HTTP_TIMEOUT_SHORT,
  REQUEST_DELAY,
  MAX_RETRIES,
  CACHE_TTL,
  CACHE_MAX_ENTRIES,
  TRUNC_LIMIT,
  DEBUG_DISPLAY_COUNT,
  DEBUG_RESULT_SLICE,
  MAX_IFRAME_DEPTH,
  validateConfig,
  getConfigInfo
} from "../lib/config.js";

describe("配置模块", () => {
  it("默认配置值正确", () => {
    expect(HTTP_TIMEOUT).toBe(15000);
    expect(HTTP_TIMEOUT_SHORT).toBe(5000);
    expect(REQUEST_DELAY).toBe(500);
    expect(MAX_RETRIES).toBe(3);
    expect(CACHE_TTL).toBe(30 * 60 * 1000);
    expect(CACHE_MAX_ENTRIES).toBe(100);
    expect(TRUNC_LIMIT).toBe(2000);
    expect(DEBUG_DISPLAY_COUNT).toBe(3);
    expect(DEBUG_RESULT_SLICE).toBe(150);
    expect(MAX_IFRAME_DEPTH).toBe(3);
  });

  it("validateConfig 验证配置", () => {
    expect(validateConfig()).toBe(true);
  });

  it("getConfigInfo 返回配置信息", () => {
    const config = getConfigInfo();
    expect(config.version).toBe(VERSION);
    expect(config.httpTimeout).toBe(15000);
    expect(config.maxRetries).toBe(3);
    expect(config.cacheTtl).toBe(30 * 60 * 1000);
    expect(config.cacheMaxEntries).toBe(100);
    expect(config.truncLimit).toBe(2000);
    expect(config.analysisTimeout).toBe(60000);
  });

  it("版本号格式正确", () => {
    expect(VERSION).toBe("3.0.0");
    expect(typeof VERSION).toBe("string");
  });
});