/* =========================================================================
 * reference.js - 早見表（名称・論理式・MIL記号・JIS記号・真理値表・ベン図）
 * ========================================================================= */
(function (global) {
  'use strict';
  const LP = global.LP;
  const ov = LP.ov;

  /** ゲートの出力ビット列を求める */
  function bitsOf(type) {
    const g = LP.GATES[type];
    const n = g.inputs;
    let s = '';
    for (let i = 0; i < (1 << n); i++) {
      const v = [];
      for (let k = 0; k < n; k++) v.push((i >> (n - 1 - k)) & 1);
      s += g.fn(v);
    }
    return s;
  }

  const LAWS = [
    ['交換則', 'A · B = B · A', 'A + B = B + A'],
    ['結合則', '(A · B) · C = A · (B · C)', '(A + B) + C = A + (B + C)'],
    ['分配則', 'A · (B + C) = A·B + A·C', 'A + B·C = (A + B)·(A + C)'],
    ['同一則', 'A · 1 = A', 'A + 0 = A'],
    ['吸収則', 'A · (A + B) = A', 'A + A·B = A'],
    ['相補則', 'A · ' + ov('A') + ' = 0', 'A + ' + ov('A') + ' = 1'],
    ['二重否定', ov(ov('A')) + ' = A', '―'],
    ['ド・モルガンの法則', ov('A · B') + ' = ' + ov('A') + ' + ' + ov('B'), ov('A + B') + ' = ' + ov('A') + ' · ' + ov('B')]
  ];

  function build(container, notation) {
    const rows = LP.GATE_ORDER.map(type => {
      const g = LP.GATES[type];
      const bits = bitsOf(type);
      const labels = g.inputs === 2 ? ['A', 'B'] : ['A'];
      return { type: type, g: g, bits: bits, labels: labels };
    });

    let h = '<div class="ref-head">';
    h += '<h2>論理ゲート早見表</h2>';
    h += '<p class="lead">名称・論理式・回路記号（MIL / JIS）・真理値表・ベン図の対応表です。' +
         '上のスイッチで記号の流派を切り替えられます（いま表示中：<b class="notation-now">' + notation + '</b>）。</p>';
    h += '</div>';

    h += '<div class="table-scroll"><table class="ref-table"><thead><tr>' +
         '<th>名称</th><th>論理式</th><th>回路記号（MIL）</th><th>回路記号（JIS）</th>' +
         '<th>真理値表</th><th>ベン図</th><th>はたらき</th>' +
         '</tr></thead><tbody>';

    rows.forEach(r => {
      h += '<tr>';
      h += '<td class="ref-name"><span class="ref-en">' + r.g.name + '</span><span class="ref-jp">' + r.g.jp + '</span></td>';
      h += '<td class="ref-formula">' + r.g.formulaHTML + '</td>';
      h += '<td class="ref-sym">' + LP.standaloneSymbol(r.type, 'MIL', { scale: 1 }) + '</td>';
      h += '<td class="ref-sym">' + LP.standaloneSymbol(r.type, 'JIS', { scale: 1 }) + '</td>';
      h += '<td class="ref-tt">' + LP.tables.miniTable(r.labels, r.bits) + '</td>';
      h += '<td class="ref-venn" data-venn="' + r.type + '"></td>';
      h += '<td class="ref-work">' + r.g.work + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';

    /* 論理代数の基本法則 */
    h += '<div class="ref-head"><h2>論理代数（ブール代数）の基本法則</h2>' +
         '<p class="lead">「じゆう工作」で両辺の回路を組んで、真理値表が一致することを確かめてみましょう。</p></div>';
    h += '<div class="table-scroll"><table class="ref-table law-table"><thead><tr><th>名称</th><th>積（AND）の形</th><th>和（OR）の形</th></tr></thead><tbody>';
    LAWS.forEach(l => { h += '<tr><td class="ref-name">' + l[0] + '</td><td class="ref-formula">' + l[1] + '</td><td class="ref-formula">' + l[2] + '</td></tr>'; });
    h += '</tbody></table></div>';

    container.innerHTML = h;

    rows.forEach(r => {
      const cell = container.querySelector('[data-venn="' + r.type + '"]');
      if (cell) cell.appendChild(LP.venn.make(r.labels, r.bits, { w: 168, h: 112 }));
    });
  }

  LP.reference = { build: build, bitsOf: bitsOf };
})(window);
