/**
 * py-spider-pro 缓存管理 v1.0
 * 复用 http_client.js LRUCache，精简实现
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CACHE_TTL, CACHE_MAX_ENTRIES, CACHE_SAVE_DEBOUNCE } from './config.js';
import { LRUCache } from './http_client.js';

const CACHE_FILE = '.mcp_spider_cache.json';

export class AnalysisCacheManager {
  constructor () {
    this._lru = new LRUCache(CACHE_MAX_ENTRIES);
    this._cache = {};
    this._file = path.join(ROOT, CACHE_FILE);
    this._dirty = false;
    this._timer = null;
    this._loadPromise = this._load();
  }
  async ready () { await this._loadPromise; }
  async _load () {
    try {
      const exists = await fs.promises.access(this._file).then(() => true).catch(() => false);
      if (exists) {
        const raw = await fs.promises.readFile(this._file, 'utf-8');
        const data = JSON.parse(raw);
        const now = Date.now();
        for (const k of Object.keys(data)) { if (data[k]._ts && now - data[k]._ts > CACHE_TTL) delete data[k]; }
        this._cache = data;
        const keys = Object.keys(data).sort((a, b) => (data[a]._ts || 0) - (data[b]._ts || 0));
        for (const k of keys) this._lru.set(k, data[k]);
      }
    } catch (_) {
      this._cache = {};
    }
  }
  _scheduleSave () {
    this._dirty = true;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => { this._timer = null; this._flush(); }, CACHE_SAVE_DEBOUNCE);
  }
  async _flush () {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      const tmp = this._file + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(this._cache), 'utf-8');
      await fs.promises.rename(tmp, this._file);
    } catch (_) { this._dirty = true; }
  }
  async flush () { if (this._timer) { clearTimeout(this._timer); this._timer = null; } if (this._dirty) await this._flush(); }
  get (key) {
    const entry = this._cache[key];
    if (!entry) return null;
    if (entry._ts && Date.now() - entry._ts > CACHE_TTL) { delete this._cache[key]; this._lru.delete(key); return null; }
    entry._ts = Date.now(); this._lru.set(key, entry); this._scheduleSave();
    return entry;
  }
  async set (key, value) { this._cache[key] = Object.assign({}, value, { _ts: Date.now() }); this._lru.set(key, this._cache[key]); this._scheduleSave(); }
  get size () { return Object.keys(this._cache).length; }
}

export function loadAnalysisCache () { return new AnalysisCacheManager(); }
export function getCacheEntry (cache, key) { return cache.get(key); }
export async function setCacheEntry (cache, key, value) { await cache.set(key, value); }

// Graceful shutdown
const __instances = [];
export function registerCacheForShutdown (c) { __instances.push(c); }
async function gracefulShutdown () { for (const c of __instances) { try { await c.flush(); } catch {} } }
process.on('SIGTERM', () => { gracefulShutdown().then(() => process.exit(0)).catch(() => process.exit(1)); });
process.on('SIGINT', () => { gracefulShutdown().then(() => process.exit(0)).catch(() => process.exit(1)); });
process.on('beforeExit', () => { gracefulShutdown().catch(() => {}); });
