/* =========================================================================
 * venn.js - ベン図の描画
 *   bits[i] が 1 の領域を塗る。i のビット並びは真理値表の行番号と同じ
 *   （先頭の変数が最上位ビット）。1〜3 変数に対応。
 * ========================================================================= */
(function (global) {
  'use strict';

  const FILL = { r: 0xFF, g: 0xE1, b: 0x2E };   // 塗りつぶし色（黄）
  const SS = 3;                                  // スーパーサンプリング倍率

  /** 円の配置を決める */
  function layout(n, W, Hh) {
    const cx = W / 2, cy = Hh / 2;
    if (n <= 1) { const r = Math.min(W, Hh) * 0.30; return { r: r, c: [[cx, cy]] }; }
    if (n === 2) { const r = Hh * 0.30; return { r: r, c: [[cx - r * 0.58, cy], [cx + r * 0.58, cy]] }; }
    const r = Hh * 0.255, d = r * 0.58;
    return { r: r, c: [[cx - d, cy - d * 0.62], [cx + d, cy - d * 0.62], [cx, cy + d * 0.95]] };
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} labels 変数名（最大3）
   * @param {string|Array} bits 各領域の値（'0110' / [0,1,1,0]）
   * @param {Object} opts {w,h,muted}
   */
  function draw(canvas, labels, bits, opts) {
    opts = opts || {};
    const W = opts.w || 200, Hh = opts.h || 132;
    const n = Math.min(labels.length, 3);
    canvas.width = W * SS;
    canvas.height = Hh * SS;
    canvas.style.width = W + 'px';
    canvas.style.height = Hh + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const at = (i) => {
      const v = typeof bits === 'string' ? bits[i] : bits[i];
      return v === 1 || v === '1';
    };
    const L = layout(n, W, Hh);
    const rr = L.r * L.r;

    /* --- 領域の塗り分け（画素ごとに所属集合を判定） --- */
    const img = ctx.createImageData(canvas.width, canvas.height);
    const data = img.data;
    const fr = opts.muted ? 0xE6 : FILL.r, fg = opts.muted ? 0xE6 : FILL.g, fb = opts.muted ? 0xE6 : FILL.b;
    for (let py = 0; py < canvas.height; py++) {
      const ly = (py + 0.5) / SS;
      for (let px = 0; px < canvas.width; px++) {
        const lx = (px + 0.5) / SS;
        let idx = 0;
        for (let k = 0; k < n; k++) {
          const dx = lx - L.c[k][0], dy = ly - L.c[k][1];
          idx = (idx << 1) | ((dx * dx + dy * dy <= rr) ? 1 : 0);
        }
        const o = (py * canvas.width + px) * 4;
        const on = at(idx);
        data[o] = on ? fr : 255;
        data[o + 1] = on ? fg : 255;
        data[o + 2] = on ? fb : 255;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    /* --- 枠線・円・ラベル --- */
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b2430';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(2, 2, W - 4, Hh - 4);           // 全体集合（普遍集合）の枠
    ctx.lineWidth = 2.4;
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.arc(L.c[k][0], L.c[k][1], L.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b2430';
    ctx.font = 'bold ' + Math.round(L.r * 0.52) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < n; k++) {
      let lx = L.c[k][0], ly = L.c[k][1];
      if (n === 2) lx += (k === 0 ? -L.r * 0.42 : L.r * 0.42);
      if (n === 3) { lx += (L.c[k][0] - W / 2) * 0.55; ly += (L.c[k][1] - Hh / 2) * 0.55; }
      ctx.fillText(labels[k], lx, ly);
    }
  }

  /** キャンバス要素を生成してベン図を描く */
  function make(labels, bits, opts) {
    const c = document.createElement('canvas');
    c.className = 'venn';
    draw(c, labels, bits, opts);
    return c;
  }

  global.LP.venn = { draw: draw, make: make };
})(window);
