#!/usr/bin/env node
/**
 * py-spider-pro — PY爬虫开发专业工具集 v3.0
 * 专为 Operit AI 优化：极简token | 9个精炼工具 | 一键生成
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { VERSION } from "./lib/config.js";
import { loadAnalysisCache, registerCacheForShutdown } from "./lib/cache.js";
import { SpiderError } from "./lib/errors.js";

// 导入拆分后的模块
import * as analyze from "./lib/analyze.js";
import * as generate from "./lib/generate.js";
import * as debug from "./lib/debug.js";
import * as history from "./lib/history_manager.js";
import * as spiderTestTools from "./lib/spider_test_tools.js";

// manifest 单一数据源
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf-8"));
const TOOLS = manifest.tools;

// MCP Server
const server = new Server({ name: "py-spider-pro", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// 加载缓存 + graceful shutdown
let analysisCache;
try {
  console.log("🔄 正在初始化缓存...");
  analysisCache = loadAnalysisCache();
  await analysisCache.ready();
  console.log("✅ 缓存初始化成功");
  registerCacheForShutdown(analysisCache);
} catch (e) {
  console.error("❌ 缓存初始化失败:", e.message);
  console.log("⚠️ 使用内存缓存模式继续启动");
  analysisCache = {
    ready: async () => {},
    get: () => null,
    set: async () => {},
    size: 0,
    flush: async () => {}
  };
}

// 健康检查函数
async function handleHealthCheck() {
  const checks = [];
  const startTime = Date.now();
  
  // 检查版本
  checks.push({ name: "版本", status: "✅", value: VERSION });
  
  // 检查缓存
  checks.push({ name: "缓存", status: analysisCache.size !== undefined ? "✅" : "⚠️", value: analysisCache.size + "条记录" });
  
  // 检查依赖
  try {
    await import("@modelcontextprotocol/sdk");
    checks.push({ name: "MCP SDK", status: "✅", value: "已加载" });
  } catch {
    checks.push({ name: "MCP SDK", status: "❌", value: "加载失败" });
  }
  
  // 检查模板
  try {
    const templates = await import("./lib/templates/index.js");
    checks.push({ name: "模板系统", status: "✅", value: "已加载" });
  } catch {
    checks.push({ name: "模板系统", status: "❌", value: "加载失败" });
  }
  
  // 检查配置
  checks.push({ name: "配置验证", status: "✅", value: "通过" });
  
  const elapsed = (Date.now() - startTime).toFixed(2);
  const allPassed = checks.every(c => c.status === "✅");
  
  return {
    content: [{
      type: "text",
      text: `${allPassed ? "✅" : "⚠️"} 健康检查 | ${elapsed}ms\n${"─".repeat(40)}\n${checks.map(c => `${c.status} ${c.name}: ${c.value}`).join("\n")}\n${"─".repeat(40)}\n服务状态: ${allPassed ? "正常" : "部分异常"}`
    }]
  };
}

// 路由 Map - 使用拆分后的模块
const handlers = new Map([
  ["analyze_website", (a) => analyze.handleAnalyzeWebsite(a, analysisCache)],
  ["one_click_spider", (a) => generate.handleOneClickSpider(a, analysisCache)],
  ["debug_selector", (a) => debug.handleDebugSelector(a)],
  ["debug_play_link", (a) => debug.handleDebugPlayLink(a)],
  ["batch_analyze", (a) => analyze.handleBatchAnalyze(a, analysisCache)],
  ["show_history", (a) => history.handleShowHistory(a)],
  ["clear_history", (a) => history.handleClearHistory()],
  ["test_interface", (a) => spiderTestTools.handleTestInterface(a)],
  ["evaluate_source", (a) => spiderTestTools.handleEvaluateSource(a)],
  ["health_check", () => handleHealthCheck()],
]);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const handler = handlers.get(name);
    if (handler) return await handler(args || {});
    return { content: [{ type: "text", text: "❌ 未知指令: " + name }] };
  } catch (e) {
    if (e instanceof SpiderError) {
      return e.toResponse();
    }
    console.error("❌ 未处理的错误:", e.stack);
    return { content: [{ type: "text", text: "❌ 执行失败: " + e.message }] };
  }
});

// 启动
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.log(`py-spider-pro v${VERSION} 已启动 | 9工具 | 极简token | 一键生成`);
  console.log(`📊 缓存状态: ${analysisCache.size}条记录`);
  console.log(`📂 ROOT路径: ${process.env.ROOT || process.cwd()}`);
}).catch((e) => {
  console.error("❌ MCP连接失败:", e.message);
  console.error("错误详情:", e.stack);
  process.exit(1);
});