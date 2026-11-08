#!/usr/bin/env python3
import argparse
import ast
import re
from pathlib import Path

REQUIRED = {'homeContent', 'homeVideoContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent'}

def check(path, final=False):
    text = path.read_text(encoding='utf-8')
    errors, warnings = [], []
    try:
        tree = ast.parse(text)
    except SyntaxError as e:
        return [f'语法错误: {e}'], warnings
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Spider']
    if not classes:
        errors.append('缺少 Spider 类')
    else:
        cls = classes[0]
        methods = {n.name for n in cls.body if isinstance(n, ast.FunctionDef)}
        errors.extend(f'缺少接口: {x}' for x in sorted(REQUIRED - methods))
        if 'getName' not in methods: errors.append('缺少 T4 getName')
        for n in cls.body:
            if isinstance(n, ast.FunctionDef) and n.name == 'getName':
                if n.body and isinstance(n.body[0], ast.Return) and isinstance(n.body[0].value, ast.Attribute) and n.body[0].value.attr == 'name':
                    errors.append('getName 不能 return self.name，壳端可能先调 getName 再 init')
        if not any(isinstance(n, ast.ImportFrom) and n.module == 'base.spider' for n in tree.body): errors.append('缺少 base.spider 导入')
    if '@class=' in text or '@class =' in text: errors.append('存在精确 class XPath')
    if 'example.com' in text:
        (errors if final else warnings).append('存在占位域名 example.com，交付前必须替换')
    if 'pagecount": 99' in text or 'pagecount": 999' in text or 'total": 999' in text: errors.append('存在伪分页值')
    if "type('R'" in text: errors.append('存在半截假 Response 对象')
    if re.search(r'except[^\n]*:\s*return\s+data', text): errors.append('异常时返回原始密文/乱码')
    if re.search(r'except[^\n]*:\s*return\s+dec', text): errors.append('异常时返回未去尾噪解密块')
    if 'final.strip().startswith' in text: errors.append('decode_page HTML 判断过窄')
    if '__main__' in text: errors.append('存在 __main__')
    return errors, warnings

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', nargs='?', default=str(Path(__file__).parent.parent / 'templates' / 'code'))
    ap.add_argument('--final', action='store_true', help='最终交付模式：占位域名等交付问题按错误处理')
    args = ap.parse_args(); root = Path(args.root); paths = [root] if root.is_file() else sorted(root.glob('*.py')); failed = 0
    for path in paths:
        errors, warnings = check(path, args.final)
        status = 'FAIL' if errors else 'WARN' if warnings else 'PASS'
        details = errors + ['警告: ' + x for x in warnings]
        print(f'{path.name}: {status}' + (': ' + '; '.join(details) if details else ''))
        failed += bool(errors)
    raise SystemExit(1 if failed else 0)

if __name__ == '__main__': main()
