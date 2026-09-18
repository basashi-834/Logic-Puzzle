/* =========================================================================
 * gates.js - 論理ゲートの定義
 * 各ゲートの名称・論理式・入力数・記号形状・真理値関数をまとめて持つ。
 * ========================================================================= */
(function (global) {
  'use strict';

  /** 上線（否定）付きの文字列を返す */
  const ov = (s) => '<span class="ov">' + s + '</span>';

  const GATES = {
    AND: {
      id: 'AND', name: 'AND', jp: '論理積', kana: 'アンド',
      inputs: 2, shape: 'and', bubble: false, jis: '&',
      formulaHTML: 'Y = A · B',
      work: '入力が<b>すべて 1</b> のときだけ 1。集合では「A と B の共通部分（積集合）」。',
      fn: (v) => v[0] & v[1]
    },
    OR: {
      id: 'OR', name: 'OR', jp: '論理和', kana: 'オア',
      inputs: 2, shape: 'or', bubble: false, jis: '≥1',
      formulaHTML: 'Y = A + B',
      work: '入力の<b>どれかが 1</b> なら 1。集合では「A と B を合わせた部分（和集合）」。',
      fn: (v) => v[0] | v[1]
    },
    NOT: {
      id: 'NOT', name: 'NOT', jp: '否定', kana: 'ノット',
      inputs: 1, shape: 'not', bubble: true, jis: '1',
      formulaHTML: 'Y = ' + ov('A'),
      work: '入力を<b>反転</b>する。集合では「A 以外の部分（補集合）」。',
      fn: (v) => v[0] ^ 1
    },
    NAND: {
      id: 'NAND', name: 'NAND', jp: '否定論理積', kana: 'ナンド',
      inputs: 2, shape: 'and', bubble: true, jis: '&',
      formulaHTML: 'Y = ' + ov('A · B'),
      work: 'AND の出力を反転したもの。<b>これ 1 種類だけで全ての論理回路が作れる</b>（万能ゲート）。',
      fn: (v) => (v[0] & v[1]) ^ 1
    },
    NOR: {
      id: 'NOR', name: 'NOR', jp: '否定論理和', kana: 'ノア',
      inputs: 2, shape: 'or', bubble: true, jis: '≥1',
      formulaHTML: 'Y = ' + ov('A + B'),
      work: 'OR の出力を反転したもの。NAND と同じく<b>万能ゲート</b>。',
      fn: (v) => (v[0] | v[1]) ^ 1
    },
    XOR: {
      id: 'XOR', name: 'EX-OR', jp: '排他的論理和', kana: 'エクスクルーシブオア',
      inputs: 2, shape: 'xor', bubble: false, jis: '=1',
      formulaHTML: 'Y = A ⊕ B<br><span class="sub">= ' + ov('A') + '·B + A·' + ov('B') + '</span>',
      work: '入力が<b>異なる</b>ときだけ 1。1 ビットの足し算（和の桁）そのもの。',
      fn: (v) => v[0] ^ v[1]
    },
    XNOR: {
      id: 'XNOR', name: 'EX-NOR', jp: '否定排他的論理和', kana: 'エクスクルーシブノア',
      inputs: 2, shape: 'xor', bubble: true, jis: '=1',
      formulaHTML: 'Y = ' + ov('A ⊕ B') + '<br><span class="sub">= ' + ov('A') + '·' + ov('B') + ' + A·B</span>',
      work: '入力が<b>等しい</b>ときだけ 1。一致回路（コンパレータ）に使われる。',
      fn: (v) => (v[0] ^ v[1]) ^ 1
    }
  };

  /** 早見表・パレットでの表示順 */
  const GATE_ORDER = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'];

  global.LP = global.LP || {};
  global.LP.GATES = GATES;
  global.LP.GATE_ORDER = GATE_ORDER;
  global.LP.ov = ov;
})(window);
