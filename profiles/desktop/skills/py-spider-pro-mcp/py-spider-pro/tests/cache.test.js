/**
 * py-spider-pro 缓存模块测试 v3.0
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AnalysisCacheManager,
  loadAnalysisCache,
  getCacheEntry,
  setCacheEntry,
  registerCacheForShutdown
} from "../lib/cache.js";

describe("缓存模块", () => {
  let cache;

  beforeEach(async () => {
    cache = loadAnalysisCache();
    await cache.ready();
  });

  afterEach(async () => {
    if (cache) {
      await cache.flush();
    }
  });

  describe("AnalysisCacheManager", () => {
    it("创建 AnalysisCacheManager 实例", () => {
      expect(cache).toBeDefined();
      expect(cache instanceof AnalysisCacheManager).toBe(true);
    });

    it("ready 方法等待缓存加载", async () => {
      const newCache = loadAnalysisCache();
      await newCache.ready();
      expect(newCache).toBeDefined();
    });

    it("set 和 get 操作", async () => {
      await setCacheEntry(cache, "testKey", { data: "testValue" });
      const entry = getCacheEntry(cache, "testKey");
      expect(entry).toBeDefined();
      expect(entry.data).toBe("testValue");
    });

    it("getCacheEntry 对不存在的 key 返回 null", () => {
      const entry = getCacheEntry(cache, "nonExistentKey");
      expect(entry).toBeNull();
    });

    it("多次 set 同一 key 会更新值", async () => {
      await setCacheEntry(cache, "key1", { data: "value1" });
      await setCacheEntry(cache, "key1", { data: "value2" });
      const entry = getCacheEntry(cache, "key1");
      expect(entry.data).toBe("value2");
    });

    it("size 属性返回缓存大小", async () => {
      await setCacheEntry(cache, "key1", { data: "value1" });
      await setCacheEntry(cache, "key2", { data: "value2" });
      expect(cache.size).toBeGreaterThanOrEqual(2);
    });

    it("flush 方法持久化缓存", async () => {
      await setCacheEntry(cache, "flushKey", { data: "flushValue" });
      await cache.flush();
      expect(cache.size).toBeGreaterThan(0);
    });
  });

  describe("registerCacheForShutdown", () => {
    it("registerCacheForShutdown 是函数", () => {
      expect(typeof registerCacheForShutdown).toBe("function");
    });

    it("可以注册缓存实例", () => {
      const newCache = loadAnalysisCache();
      expect(() => registerCacheForShutdown(newCache)).not.toThrow();
    });
  });
});