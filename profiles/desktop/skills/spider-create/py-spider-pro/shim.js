// 动态 require shim 用于 esbuild ESM 打包
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.require = require;