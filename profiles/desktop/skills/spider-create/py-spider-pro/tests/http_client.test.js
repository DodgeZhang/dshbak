/**
 * py-spider-pro HTTP 客户端测试 v3.0
 */
import { describe, it, expect } from "vitest";
import {
  LRUCache,
  fetchPage,
  fetchPagePost,
  CloudflareChallengeError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  CaptchaError
} from "../lib/http_client.js";

describe("HTTP 客户端模块", () => {
  describe("LRUCache", () => {
    it("创建 LRUCache 实例", () => {
      const cache = new LRUCache(3);
      expect(cache).toBeDefined();
    });

    it("基本 get/set 操作", () => {
      const cache = new LRUCache(3);
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("LRU 淘汰机制", () => {
      const cache = new LRUCache(2);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
    });

    it("更新已存在的 key", () => {
      const cache = new LRUCache(3);
      cache.set("key1", "value1");
      cache.set("key1", "value2");
      expect(cache.get("key1")).toBe("value2");
      expect(cache.size).toBe(1);
    });

    it("删除 key", () => {
      const cache = new LRUCache(3);
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeNull();
    });

    it("清空缓存", () => {
      const cache = new LRUCache(3);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it("获取缓存大小", () => {
      const cache = new LRUCache(3);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);
    });

    it("访问已存在的 key 会更新 LRU 顺序", () => {
      const cache = new LRUCache(2);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.get("key1");
      cache.set("key3", "value3");
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBeNull();
    });
  });

  describe("错误类", () => {
    it("CloudflareChallengeError 继承 Error", () => {
      const error = new CloudflareChallengeError("CF Error");
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("CLOUDFLARE_ERROR");
    });

    it("NetworkError 继承 Error", () => {
      const error = new NetworkError("Network Error");
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("TimeoutError 继承 Error", () => {
      const error = new TimeoutError("Timeout Error");
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("TIMEOUT_ERROR");
    });

    it("RateLimitError 继承 Error", () => {
      const error = new RateLimitError("Rate Limit Error");
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("RATE_LIMIT_ERROR");
    });

    it("CaptchaError 继承 Error", () => {
      const error = new CaptchaError("Captcha Error");
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("CAPTCHA_ERROR");
    });
  });

  describe("fetchPage 函数", () => {
    it("fetchPage 是函数", () => {
      expect(typeof fetchPage).toBe("function");
    });

    it("fetchPagePost 是函数", () => {
      expect(typeof fetchPagePost).toBe("function");
    });
  });
});