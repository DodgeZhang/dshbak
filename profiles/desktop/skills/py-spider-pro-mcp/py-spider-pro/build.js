import * as esbuild from 'esbuild';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建 shim 文件用于处理动态 require
const shimContent = `
import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __dirname } from 'node:path';

// 全局 require shim
globalThis.require = __createRequire(import.meta.url);
globalThis.__filename = __fileURLToPath(import.meta.url);
globalThis.__dirname = __dirname(globalThis.__filename);

// 确保 __dirname 在模块中可用
const __localDirname = __dirname(import.meta.url);
`;

// 确保 dist 目录存在
const distDir = join(__dirname, './dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

async function build() {
  try {
    // 构建主文件为 ESM 格式（支持顶层 await）
    await esbuild.build({
      entryPoints: ['index.js'],
      bundle: true,
      minify: true,
      sourcemap: false,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(distDir, 'index.mjs'),
      external: [],
      treeShaking: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      // 注入 shim 来处理动态 require
      inject: [],
      banner: {
        js: shimContent
      },
      // 优化选项
      drop: ['debugger'],
      pure: ['console.log', 'console.info', 'console.warn', 'console.error']
    });

    // 复制必要的配置文件
    const filesToCopy = [
      './manifest.json',
      './lib/selectors.json'
    ];
    
    for (const filePath of filesToCopy) {
      const srcPath = join(__dirname, filePath);
      const destPath = join(distDir, filePath.split('/').pop());
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`📄 复制文件: ${filePath}`);
      }
    }

    // 复制 templates 目录
    const templatesSrc = join(__dirname, './lib/templates');
    const templatesDest = join(distDir, './templates');
    if (fs.existsSync(templatesSrc)) {
      if (!fs.existsSync(templatesDest)) {
        fs.mkdirSync(templatesDest, { recursive: true });
      }
      const templateFiles = fs.readdirSync(templatesSrc);
      for (const file of templateFiles) {
        if (file.endsWith('.js')) {
          fs.copyFileSync(join(templatesSrc, file), join(templatesDest, file));
        }
      }
      console.log(`📁 复制 templates 目录 (${templateFiles.length} 个文件)`);
    }

    console.log('✅ 构建完成！输出目录: ./dist/');
    
    // 显示文件大小
    const stats = fs.statSync(join(distDir, 'index.mjs'));
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`📦 输出文件大小: ${sizeKB} KB`);
    
    // 对比原始 node_modules 大小
    const nodeModulesStats = fs.statSync(join(__dirname, 'node_modules'));
    const nodeModulesKB = (nodeModulesStats.size / 1024).toFixed(2);
    console.log(`📁 原始 node_modules 大小: ${nodeModulesKB} KB`);
    
    const reduction = ((1 - stats.size / nodeModulesStats.size) * 100).toFixed(2);
    console.log(`💡 体积减小: ${reduction}%`);
    
  } catch (err) {
    console.error('❌ 构建失败:', err);
    process.exit(1);
  }
}

build();