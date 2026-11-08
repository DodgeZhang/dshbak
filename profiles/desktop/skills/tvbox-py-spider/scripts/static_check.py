#!/usr/bin/env python3
import argparse
import ast
import re
from pathlib import Path

SIGNATURES = {
    'init': ['self', 'extend'], 'getName': ['self'], 'homeContent': ['self', 'filter'],
    'homeVideoContent': ['self'], 'categoryContent': ['self', 'tid', 'pg', 'filter', 'extend'],
    'detailContent': ['self', 'ids'], 'searchContent': ['self', 'key', 'quick', 'pg'],
    'playerContent': ['self', 'flag', 'id', 'vipFlags']
}

def _is_main_guard(node):
    return isinstance(node, ast.If) and isinstance(node.test, ast.Compare) and isinstance(node.test.left, ast.Name) and node.test.left.id == '__name__' and any(isinstance(x, ast.Constant) and x.value == '__main__' for x in node.test.comparators)

def _inherits_spider(cls):
    return any((isinstance(x, ast.Name) and x.id == 'Spider') or (isinstance(x, ast.Attribute) and x.attr == 'Spider') for x in cls.bases)

def _number(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) else None

def check(path, final=False):
    try: text = path.read_text(encoding='utf-8')
    except Exception as e: return [f'文件读取失败: {e}'], []
    errors, warnings = [], []
    try: tree = ast.parse(text)
    except SyntaxError as e: return [f'语法错误: {e}'], warnings
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Spider']
    if not classes: errors.append('缺少 Spider 类')
    else:
        cls = classes[0]
        if not _inherits_spider(cls): errors.append('Spider 类未继承基类 Spider')
        methods = {n.name: n for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for name, expected in SIGNATURES.items():
            if name not in methods:
                errors.append(f'缺少接口: {name}'); continue
            actual = [x.arg for x in methods[name].args.args]
            allowed = [expected]
            if name in ('init', 'searchContent'): allowed.append(expected[:-1])
            if actual not in allowed: errors.append(f'接口签名错误: {name}({", ".join(actual)})')
        node = methods.get('getName')
        if node and node.body and isinstance(node.body[0], ast.Return) and isinstance(node.body[0].value, ast.Attribute) and node.body[0].value.attr == 'name': errors.append('getName 不能 return self.name，壳端可能先调 getName 再 init')
        if not any(isinstance(n, ast.ImportFrom) and n.module == 'base.spider' and any(a.name == 'Spider' for a in n.names) for n in ast.walk(tree)): errors.append('缺少 base.spider.Spider 导入')
    if re.search(r'@class\s*=', text, re.I): errors.append('存在精确 class XPath')
    if re.search(r'https?://(?:[^/]+\.)?example\.(?:com|org|net)(?![A-Za-z0-9.-])', text, re.I): (errors if final else warnings).append('存在占位域名，交付前必须替换')
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                k = key.value if isinstance(key, ast.Constant) else None; v = _number(value)
                if k in ('pagecount', 'total') and v in (99, 999): errors.append(f'存在伪分页值: {k}={v}')
        if isinstance(node, ast.Assign):
            value = _number(node.value)
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ('pagecount', 'total') and value in (99, 999): errors.append(f'存在伪分页值: {target.id}={value}')
    if "type('R'" in text or 'type("R"' in text: errors.append('存在半截假 Response 对象')
    if re.search(r'except[^\n]*:\s*return\s+data', text): errors.append('异常时返回原始密文/乱码')
    if re.search(r'except[^\n]*:\s*return\s+dec', text): errors.append('异常时返回未去尾噪解密块')
    if 'final.strip().startswith' in text: errors.append('decode_page HTML 判断过窄')
    if any(_is_main_guard(n) for n in tree.body): errors.append('存在 __main__ 测试块')
    if re.search(r'["\']parse["\']\s*:\s*0', text) and not any(x in text for x in ('#EXTM3U', '_probe_media', '_validate_media')): warnings.append('parse:0 未见真直链验证门禁（开发时必须实测 #EXTM3U/媒体魔数）')
    if re.search(r'pagecount\s*["\']?\s*[:=]\s*1\s*(?:[,}\n]|$)', text): warnings.append('存在固定 pagecount=1，确认是否后续被接口值覆盖')
    if re.search(r'vod_play_from\s*=\s*["\'][^"\']*(?:选择播放源|播放线路|展开|收起)', text): errors.append('线路名包含界面提示词')
    if re.search(r'\b(?:yeerx|mttby)://', text, re.I): errors.append('存在伪协议播放地址')
    if re.search(r'parse\s*["\']?\s*[:=]\s*0[^\n]*(?:/play/|/player/|/detail/)', text, re.I): errors.append('parse:0 仍直接返回播放页路径')
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == 'requests' and node.func.attr in ('get', 'post'): errors.append('存在裸 requests 请求，必须复用 session')
    return list(dict.fromkeys(errors)), list(dict.fromkeys(warnings))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', nargs='?', default=str(Path(__file__).parent.parent / 'assets' / 'templates'))
    ap.add_argument('--final', action='store_true', help='最终交付模式：占位域名等交付问题按错误处理')
    args = ap.parse_args(); root = Path(args.root)
    if not root.exists(): print(f'{root}: FAIL: 路径不存在'); raise SystemExit(1)
    paths = [root] if root.is_file() else sorted(root.rglob('*.py'))
    paths = [p for p in paths if '__pycache__' not in p.parts and 'archive' not in p.parts]
    if not paths: print(f'{root}: FAIL: 未找到 Python 源文件'); raise SystemExit(1)
    failed = 0
    for path in paths:
        errors, warnings = check(path, args.final); status = 'FAIL' if errors else 'WARN' if warnings else 'PASS'; details = errors + ['警告: ' + x for x in warnings]
        print(f'{path}: {status}' + (': ' + '; '.join(details) if details else '')); failed += bool(errors)
    raise SystemExit(1 if failed else 0)

if __name__ == '__main__': main()