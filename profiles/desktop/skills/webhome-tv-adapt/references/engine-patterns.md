# TV 焦点引擎关键代码模式

从 AppleMusicTV.html 注入引擎提炼的可复用骨架。全部包在一个 IIFE 里，零依赖、不碰原应用闭包变量。

## 设备识别

```js
var tvUA = /android tv|googletv|web0s|tizen|bravia|vidaa|aft|smarttv/i.test(navigator.userAgent);
var coarse = matchMedia("(pointer:coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
var tvMode = new URL(location.href).searchParams.get("tv");
tvMode = tvMode !== null ? tvMode === "1" : (localStorage.aq_tv_mode ? localStorage.aq_tv_mode === "1" : tvUA);
// 非触屏首次按方向键自动进 TV；F2 切换并写 localStorage + toast
document.documentElement.classList.toggle("tv-mode", tvMode);
document.documentElement.classList.toggle("touch-device", coarse);
```

## 候选与可视

```js
var CUSTOM = ".song,.album,.ch-item,.tab 变体,.np-lyrics,.np-art-wrap,#mini.show";
var SELECTOR = "a[href],button,input,select,textarea,[role=button]," + CUSTOM;
var SHEET_ROW = "#sheetBody div[style*=\"cursor: pointer\"]"; // 无类名 inline 行

function isVisible(el) {
  if (!el || el.disabled) return false;
  var r = el.getBoundingClientRect();
  if (r.width < 3 || r.height < 3) return false;            // 不做视口裁剪
  var cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.pointerEvents === "none") return false;
  if (el.closest(".page") && !el.closest(".page.on")) return false;
  return true;
}
function gather(L) {
  var out = [], seen = new Set();
  var sel = SELECTOR + (L.kind === "sheet" ? "," + SHEET_ROW : "");
  L.roots.forEach(function (root) {
    root.querySelectorAll(sel).forEach(function (el) {
      if (seen.has(el) || !isVisible(el)) return;
      if (tvMode && !el.hasAttribute("tabindex") &&
          (el.matches(CUSTOM) || el.matches(SHEET_ROW))) el.setAttribute("tabindex", "-1");
      seen.add(el); out.push(el);
    });
  });
  return out;
}
```

## 空间评分（三档）

```js
// dir: right/left/down/up；半平面容差 6px
if (!half) continue;
var score = edge + cross * 1.7;
if (edge > -4) { /* best */ }
else if (act.contains(el)) { edge = Math.max(edge, -ar.width * 0.8); /* innerBest: 行内小钮 */ }
else { edge = Math.max(edge, -ar.width * 0.55); /* relaxBest */ }
```

## 显式焦点环（兼容不派发 focusin 的 WebView）

```js
var ringHolder = null;
function applyRing(el) {
  if (ringHolder && ringHolder !== el) ringHolder.classList.remove("tv-focus");
  if (el) el.classList.add("tv-focus");
  ringHolder = el || null;
}
function focusEl(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  applyRing(el);
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (pageAnchor) pageAnchor[currentPageId] = el;
}
// window focusin/focusout 仅兜底：focusin 时 applyRing(e.target)
```

## 分层

```js
function layer() {
  if ($(".src-editor-mask.open")) return { kind: "editor", roots: [ed] };
  // 新版切源弹层：与音质弹层共用 #qPopMask，但选项在独立容器
  var nmp = $("npMorePop");
  if (nmp && nmp.classList.contains("open")) return { kind: "qpop", roots: [nmp] };
  if (qPop.open) return { kind: "qpop", roots: [qPop] };
  if (sheetMask.open) return { kind: "sheet", roots: [$("sheetBody")] };
  if (platWrap.open) return { kind: "plat", roots: [platWrap] };
  if (np.open) return { kind: "np", roots: [np], lyrics: np.classList.contains("lyrics-full") };
  // 新版沉浸式详情页（z-56，低于播放页 z-80）
  var dp = $("detailPage");
  if (dp && dp.classList.contains("open")) return { kind: "detail", roots: [dp] };
  return { kind: "page", roots: [pageEl, header, dock], page: pageEl };
}
```

## 新增弹层层级（detail）

新版沉浸式歌单/榜单详情页需要完整接入焦点系统：

```js
// KINDS 与 OPEN_DELAY 加入 detail
var KINDS = ["editor", "qpop", "sheet", "plat", "np", "detail"];
var OPEN_DELAY = { editor: 180, qpop: 200, sheet: 240, plat: 180, np: 280, detail: 320 };

// pickDefault：详情页默认焦点
if (L.kind === "detail") {
  return L.roots[0].querySelector(".detail-song-row") || $("detailBackBtn") || list[0];
}

// doBack：详情页返回
if (L.kind === "detail") { click($("detailBackBtn")); return; }

// closeTopOverlay：详情页层级最低，放最后
if ($("detailPage") && $("detailPage").classList.contains("open")) {
  _overlayJustClosed = Date.now();
  click($("detailBackBtn"));
  return true;
}

// sig()：详情页状态
detail: !!($("detailPage") && $("detailPage").classList.contains("open")),
```

## ensureNowPlaying 守卫（详情页与播放页互不误开）

```js
function ensureNowPlaying(trigger) {
  if (!tvMode) return;
  var np = $("np");
  if (np && np.classList.contains("open")) return;
  // 点击/确认触发时，详情页已开则不误开播放页
  // audio-play（音频开始）和 detail-row（详情页点歌）不受限
  if (trigger !== "audio-play" && trigger !== "detail-row") {
    var dp = $("detailPage");
    if (dp && dp.classList.contains("open")) return;
  }
  // setTimeout 回调内同样守卫
  ensureTimer = setTimeout(function () {
    if (trigger !== "audio-play" && trigger !== "detail-row") {
      var dp1 = $("detailPage");
      if (dp1 && dp1.classList.contains("open")) return;
    }
    // ... 兜底打开播放页
  }, 120);
}

// click 捕获：区分触发来源
document.addEventListener("click", function (e) {
  if (!tvMode) return;
  var t = e.target;
  var playable = t.closest(".album") || t.closest(".song") ||
                 t.closest(".ch-item") || t.closest(".duo-card") ||
                 t.closest(".detail-song-row") || t.id === "guessCard";
  if (playable) ensureNowPlaying(
    playable.classList.contains("detail-song-row") ? "detail-row" : "click"
  );
}, true);
```

## 「当前播放」按钮模式（仅 TV 模式显示）

新增侧栏按钮进入正在播放的播放页，需注意：

1. **不用 `.tab` 类**：原应用 `$$(".tab").forEach(t => on(t,"click",()=>go(t.dataset.p)))` 会把 `.tab` 元素当页面切换处理。用独立类名如 `.tab-now`。
2. **仅 TV 模式显示**：手机模式完全隐藏以保持官方 UI。
3. **双模式开播放页**：TV 走 ensureNowPlaying 兜底；非 TV 直接 `#mini.click()`。

```css
/* 默认隐藏，仅 TV 模式显示 */
.tab-now {
  display: none !important;
  flex: 1 1 auto; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  border: none; background: transparent;
  color: rgba(60, 60, 67, 0.78);
  font-size: 10px; font-weight: 500; font-family: inherit;
  white-space: nowrap; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color .28s ease, transform .32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity .2s ease;
}
html.tv-mode .tab-now { display: flex !important; }
.tab-now.is-on { color: var(--pink); }
.tab-now.is-off { opacity: .38; }

@media (orientation: landscape), (min-aspect-ratio: 16/9) {
  html.tv-mode .dock .tab-now {
    flex: 0 0 auto !important;
    width: 60px !important; height: 60px !important;
    border-radius: 50%;
    flex-direction: column; justify-content: center;
    gap: 2px; font-size: 9px;
    color: var(--label-2);
  }
}
```

```js
// 独立脚本（不依赖引擎内部函数）
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var btn = $("tabNow");
  if (!btn) return;
  var mini = $("mini"), npEl = $("np"), audioEl = $("audio");

  function npOpen() { return !!(npEl && npEl.classList.contains("open")); }
  function hasTrack() {
    if (mini && mini.classList.contains("show")) return true;
    return !!(audioEl && audioEl.src && !audioEl.error);
  }
  function paint() {
    var off = !hasTrack();
    btn.classList.toggle("is-on", npOpen());
    btn.classList.toggle("is-off", off);
    btn.setAttribute("aria-disabled", off ? "true" : "false");
  }
  function openNow() {
    if (npOpen()) return;
    if (!hasTrack()) { /* 轻反馈 */ return; }
    try { if (mini) mini.click(); } catch (e) {}
    setTimeout(function () {
      var n = $("np");
      if (n && !n.classList.contains("open")) {
        n.classList.remove("closing", "lyrics-full");
        n.classList.add("open");
        try { history.pushState({ aqNp: 1 }, "", "#player"); } catch (e) {}
      }
      paint();
    }, 170);
  }
  btn.addEventListener("click", openNow);
  if (mini) new MutationObserver(paint).observe(mini, { attributes: true, attributeFilter: ["class"] });
  if (npEl) new MutationObserver(paint).observe(npEl, { attributes: true, attributeFilter: ["class"] });
  if (audioEl) {
    audioEl.addEventListener("emptied", function () { setTimeout(paint, 0); });
    audioEl.addEventListener("loadstart", paint);
    audioEl.addEventListener("play", paint);
  }
  paint();
})();
```

## 元素删除后的返回链路适配

新版可能删除引擎依赖的元素（如 `#npClose` 被移除）。返回逻辑改走官方 history 链路：

```js
// doBack 中的 np 返回：不再 click(#npClose)，改走 history.back()
if (L.kind === "np") {
  try { history.back(); } catch (e) {
    // 兜底：直接移除 open class
    var n = $("np");
    if (n) { n.classList.add("closing"); n.classList.remove("open", "lyrics-full"); }
  }
  return;
}
```

## 弹层焦点堆栈（不要用单布尔）

```js
var KINDS = ["editor", "qpop", "sheet", "plat", "np"];
var focusStack = [];
// sig() 返回 5 个布尔 + lyrics + page；与上一帧 cur 对比：
//   false->true 的层：push({k, f: document.activeElement})，setTimeout(focusDefault, 180~280ms)
//   true->false 的层：从栈顶弹出匹配项恢复其 f（多层同帧关闭循环弹），
//                     80ms 后 f 仍可见且在当前层候选中才 focusEl(f)，否则 focusDefault()
// 例外：lyrics 切换不压栈，直接 focusEl(歌词/播放键)
```

## 按键分流要点

```js
window.addEventListener("keydown", function (e) {
  if (!tvMode) return;
  var k = e.key, kc = e.keyCode;
  // 文本态：Esc 只 blur；单行 INPUT 的上下键 = blur 后 move(dir, input)；其余放行
  if (typing(e.target)) {
    if (k === "Escape") { e.target.blur(); return; }
    if (e.target.tagName === "INPUT" && (k === "ArrowUp" || k === "ArrowDown")) {
      var from = e.target; from.blur(); move(k === "ArrowUp" ? "up" : "down", from);
    }
    return;
  }
  var L = layer();
  if (/^(Escape|Backspace|Back|XF86Back)$/.test(k) || kc === 10009 || kc === 4) {
    e.preventDefault(); doBack(L); return;   // lyrics 走 history.back()
  }
  if (e.target.id === "npSeek" && dir) { seekStep(dir); e.preventDefault(); return; }
  if (k === "Enter" || k === " " || kc === 23) { e.preventDefault(); e.target.click(); return; }
  if (dir) { e.preventDefault(); move(dir); }
}, true);
```

## 必须特判的两件事

1. **容器+内部按钮**（mini 条/歌曲行）：`if (act !== box && !box.contains(act)) list = list.filter(el => el === box || !box.contains(el));`
2. **几何捷径**：播放页控制行上键直达进度条（歌词面板整幅会截获）；长列表到底的方向键用 relax 档落到 dock。

## 防自动收起

```js
new MutationObserver(function () {
  if (tvMode && dock.classList.contains("collapsed")) dock.classList.remove("collapsed");
}).observe(dock, { attributes: true, attributeFilter: ["class"] });
```

## 测试注意

- 连续方向键之间留 ≥150ms 等滚动；不要在一个同步循环里连调 move()。
- 自动化环境可能不派发 focus 事件、批量按键后读状态偶发 undefined：按键与读取拆两个调用。
- 调试 move() 与真实按键都要验证（起点元素不同会得到不同结果，对比前先打印 activeElement 与 rect）。
