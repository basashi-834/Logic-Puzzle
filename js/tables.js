/* =========================================================================
 * tables.js - 真理値表の HTML 生成
 * ========================================================================= */
(function (global) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /** 入力の組み合わせ（行番号 i の k 番目のビット） */
  function bitOf(i, n, k) { return (i >> (n - 1 - k)) & 1; }

  /**
   * 1 出力のコンパクトな真理値表（早見表・クイズ用）
   * @param {string[]} labels 入力名
   * @param {string} bits 出力ビット列
   */
  function miniTable(labels, bits, outName) {
    const n = labels.length;
    let h = '<table class="tt tt-mini"><thead><tr>';
    labels.forEach(l => { h += '<th>' + esc(l) + '</th>'; });
    h += '<th class="tt-out">' + esc(outName || 'Y') + '</th></tr></thead><tbody>';
    for (let i = 0; i < (1 << n); i++) {
      const on = bits[i] === '1';
      h += '<tr class="' + (on ? 'on' : '') + '">';
      for (let k = 0; k < n; k++) h += '<td>' + bitOf(i, n, k) + '</td>';
      h += '<td class="tt-out ' + (on ? 'v1' : 'v0') + '">' + (bits[i] === undefined ? '-' : bits[i]) + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /**
   * 回路の真理値表。target があれば「目標」と「いま」を並べて合否を表示する。
   * @param {Object} tt LP.Circuit#truthTable() の戻り値
   * @param {Object} [target] 出力ラベル → 目標ビット列
   */
  function circuitTable(tt, target) {
    const nIn = tt.inputs.length;
    if (nIn === 0) return '<p class="empty">入力スイッチを置くと真理値表が出ます。</p>';
    const cmp = !!target;
    let h = '<table class="tt">';
    if (cmp) {
      h += '<thead><tr>';
      h += '<th colspan="' + nIn + '" class="grp">入力</th>';
      tt.outputs.forEach(o => { h += '<th colspan="3" class="grp">' + esc(o) + '</th>'; });
      h += '</tr><tr>';
    } else {
      h += '<thead><tr>';
    }
    tt.inputs.forEach(l => { h += '<th>' + esc(l) + '</th>'; });
    if (cmp) {
      tt.outputs.forEach(() => { h += '<th class="tt-target">目標</th><th class="tt-out">いま</th><th class="tt-judge"></th>'; });
    } else {
      tt.outputs.forEach(o => { h += '<th class="tt-out">' + esc(o) + '</th>'; });
    }
    h += '</tr></thead><tbody>';

    tt.rows.forEach((row, i) => {
      const anyOn = row.out.some(v => v === 1);
      h += '<tr class="' + (anyOn ? 'on' : '') + '">';
      row.in.forEach(b => { h += '<td>' + b + '</td>'; });
      row.out.forEach((v, k) => {
        const cur = (v === null || v === undefined) ? '-' : String(v);
        if (cmp) {
          const want = (target[tt.outputs[k]] || '')[i];
          const ok = want !== undefined && cur === want;
          h += '<td class="tt-target">' + (want === undefined ? '-' : want) + '</td>';
          h += '<td class="tt-out ' + (cur === '1' ? 'v1' : cur === '0' ? 'v0' : 'vx') + '">' + cur + '</td>';
          h += '<td class="tt-judge">' + (ok ? '<span class="ok">✓</span>' : '<span class="ng">✕</span>') + '</td>';
        } else {
          h += '<td class="tt-out ' + (cur === '1' ? 'v1' : cur === '0' ? 'v0' : 'vx') + '">' + cur + '</td>';
        }
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  global.LP.tables = { miniTable: miniTable, circuitTable: circuitTable, esc: esc, bitOf: bitOf };
})(window);
