/* =========================================================================
 * symbols.js - 回路記号（MIL記号 / JIS記号）の SVG 生成
 * ローカル座標系は 幅 0..right, 高さ 0..44 （入力側の辺が x=0）。
 * ========================================================================= */
(function (global) {
  'use strict';
  const GATES = global.LP.GATES;

  const H = 44;                 // 記号の高さ
  const BUBBLE_R = 5.5;         // 否定を表す丸（バブル）の半径

  /* MIL記号（特殊形状記号）の輪郭 */
  const MIL_SHAPE = {
    and: { right: 52, d: 'M0 0 H30 A22 22 0 0 1 30 44 H0 Z' },
    or:  { right: 54, d: 'M0 0 Q30 2 54 22 Q30 42 0 44 Q12 22 0 0 Z' },
    xor: { right: 56, d: 'M7 0 Q37 2 56 22 Q37 42 7 44 Q19 22 7 0 Z', extra: 'M0 0 Q12 22 0 44' },
    not: { right: 46, d: 'M1 0 L46 22 L1 44 Z' }
  };

  const JIS_RIGHT = 56;

  /**
   * ゲート記号の SVG 断片を返す。
   * @param {string} type  ゲート種別（AND など）
   * @param {string} notation 'MIL' | 'JIS'
   * @returns {{svg:string, right:number, height:number}} right はバブルを含む右端
   */
  function gateSymbol(type, notation) {
    const g = GATES[type];
    let svg = '';
    let right;

    if (notation === 'JIS') {
      right = JIS_RIGHT;
      svg += '<rect class="sym-fill" x="0" y="0" width="' + JIS_RIGHT + '" height="' + H + '"/>';
      svg += '<text class="sym-label" x="7" y="18">' + g.jis + '</text>';
    } else {
      const s = MIL_SHAPE[g.shape];
      right = s.right;
      svg += '<path class="sym-fill" d="' + s.d + '"/>';
      if (s.extra) svg += '<path class="sym-line" d="' + s.extra + '"/>';
    }

    if (g.bubble) {
      svg += '<circle class="sym-fill" cx="' + (right + BUBBLE_R) + '" cy="' + (H / 2) + '" r="' + BUBBLE_R + '"/>';
      right += BUBBLE_R * 2;
    }
    return { svg: svg, right: right, height: H };
  }

  /**
   * 独立した記号図（早見表・クイズ用）を組み立てる。入出力の引き出し線とラベル付き。
   */
  function standaloneSymbol(type, notation, opts) {
    opts = opts || {};
    const g = GATES[type];
    const sym = gateSymbol(type, notation);
    const lead = 26;                          // 引き出し線の長さ
    const labelW = opts.labels === false ? 0 : 14;
    const W = labelW + lead + sym.right + lead + labelW;
    const scale = opts.scale || 1;
    const ox = labelW, oy = 8;
    const cy = oy + sym.height / 2;
    const ys = g.inputs === 2 ? [oy + 12, oy + 32] : [cy];
    let s = '<svg class="sym-svg" viewBox="0 0 ' + W + ' ' + (sym.height + 16) + '" width="' + (W * scale) +
            '" height="' + ((sym.height + 16) * scale) + '" role="img" aria-label="' + g.name + ' の' + notation + '記号">';
    // 入力線
    ys.forEach((y, i) => {
      s += '<line class="sym-line" x1="' + ox + '" y1="' + y + '" x2="' + (ox + lead) + '" y2="' + y + '"/>';
      if (labelW) s += '<text class="sym-pin" x="' + (ox - 4) + '" y="' + (y + 5) + '" text-anchor="end">' +
                       (g.inputs === 2 ? 'AB'[i] : 'A') + '</text>';
    });
    // 出力線
    s += '<line class="sym-line" x1="' + (ox + lead + sym.right) + '" y1="' + cy +
         '" x2="' + (ox + lead + sym.right + lead) + '" y2="' + cy + '"/>';
    if (labelW) s += '<text class="sym-pin" x="' + (ox + lead + sym.right + lead + 4) + '" y="' + (cy + 5) + '">Y</text>';
    s += '<g transform="translate(' + (ox + lead) + ',' + oy + ')">' + sym.svg + '</g>';
    s += '</svg>';
    return s;
  }

  global.LP.gateSymbol = gateSymbol;
  global.LP.standaloneSymbol = standaloneSymbol;
  global.LP.SYM_H = H;
})(window);
