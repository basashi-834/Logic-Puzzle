/* =========================================================================
 * circuit.js - 回路モデルと評価エンジン
 *   ノード種別: 'in'（入力スイッチ） / 'out'（出力ランプ） / 'gate'（論理ゲート）
 *   配線: { id, from: ノードID, to: ノードID, port: 入力ポート番号 }
 * ========================================================================= */
(function (global) {
  'use strict';
  const GATES = global.LP.GATES;
  const ov = global.LP.ov;

  /* ノードの寸法・端子位置（描画と配線計算で共用） */
  const GEOM = {
    gate: { w: 96, h: 48 },
    in:   { w: 76, h: 40 },
    out:  { w: 76, h: 40 }
  };

  function arity(node) {
    if (node.kind === 'out') return 1;
    if (node.kind === 'in') return 0;
    return GATES[node.type].inputs;
  }

  /** 端子の座標（ノード原点からの相対位置） */
  function portOffset(node, dir, port) {
    if (node.kind === 'in') return { x: GEOM.in.w, y: GEOM.in.h / 2 };
    if (node.kind === 'out') return { x: 0, y: GEOM.out.h / 2 };
    const g = GEOM.gate;
    if (dir === 'out') return { x: g.w, y: g.h / 2 };
    return GATES[node.type].inputs === 2
      ? { x: 0, y: port === 0 ? 14 : 34 }
      : { x: 0, y: g.h / 2 };
  }

  function portPos(node, dir, port) {
    const o = portOffset(node, dir, port);
    return { x: node.x + o.x, y: node.y + o.y };
  }

  function sizeOf(node) { return GEOM[node.kind]; }

  let seq = 0;
  const uid = (p) => p + '_' + (++seq) + '_' + Math.random().toString(36).slice(2, 6);

  class Circuit {
    constructor() {
      this.nodes = new Map();
      this.wires = new Map();
    }

    /* ---------- 構築 ---------- */
    addGate(type, x, y) {
      const n = { id: uid('g'), kind: 'gate', type: type, x: x, y: y };
      this.nodes.set(n.id, n);
      return n;
    }
    addInput(label, x, y, fixed) {
      const n = { id: uid('i'), kind: 'in', label: label, x: x, y: y, value: 0, fixed: !!fixed };
      this.nodes.set(n.id, n);
      return n;
    }
    addOutput(label, x, y, fixed) {
      const n = { id: uid('o'), kind: 'out', label: label, x: x, y: y, fixed: !!fixed };
      this.nodes.set(n.id, n);
      return n;
    }
    remove(id) {
      this.nodes.delete(id);
      for (const [wid, w] of this.wires) {
        if (w.from === id || w.to === id) this.wires.delete(wid);
      }
    }
    removeWire(id) { this.wires.delete(id); }

    /** 出力端子 from → 入力端子 (to, port) を接続する。既存の接続は置き換える。 */
    connect(from, to, port) {
      if (from === to) return null;
      for (const [wid, w] of this.wires) {
        if (w.to === to && w.port === port) this.wires.delete(wid);
      }
      const w = { id: uid('w'), from: from, to: to, port: port };
      this.wires.set(w.id, w);
      return w;
    }
    wireInto(nodeId, port) {
      for (const w of this.wires.values()) if (w.to === nodeId && w.port === port) return w;
      return null;
    }

    /* ---------- 取得 ---------- */
    inputNodes()  { return [...this.nodes.values()].filter(n => n.kind === 'in').sort(byLabel); }
    outputNodes() { return [...this.nodes.values()].filter(n => n.kind === 'out').sort(byLabel); }
    gateNodes()   { return [...this.nodes.values()].filter(n => n.kind === 'gate'); }
    gateCount()   { return this.gateNodes().length; }

    /**
     * 与えられた入力値で回路を評価する。
     * @param {Object} vals ラベル → 0/1
     * @returns {{value:Map<string,(0|1|null)>, loop:boolean}}
     */
    evaluate(vals) {
      const memo = new Map();
      const state = new Map();
      let loop = false;
      const self = this;

      function val(id) {
        if (memo.has(id)) return memo.get(id);
        if (state.get(id) === 'visiting') { loop = true; return null; }
        state.set(id, 'visiting');
        const n = self.nodes.get(id);
        let out = null;
        if (!n) { out = null; }
        else if (n.kind === 'in') {
          out = vals && Object.prototype.hasOwnProperty.call(vals, n.label) ? (vals[n.label] ? 1 : 0) : (n.value ? 1 : 0);
        } else {
          const k = arity(n);
          const ins = [];
          for (let p = 0; p < k; p++) {
            const w = self.wireInto(id, p);
            ins.push(w ? val(w.from) : null);
          }
          if (ins.some(v => v === null || v === undefined)) out = null;
          else out = n.kind === 'out' ? ins[0] : GATES[n.type].fn(ins);
        }
        state.set(id, 'done');
        memo.set(id, out);
        return out;
      }

      for (const id of this.nodes.keys()) val(id);
      return { value: memo, loop: loop };
    }

    /**
     * 真理値表を作る。行番号 i の第 k 入力ビットは (i >> (n-1-k)) & 1（先頭ラベルが最上位）。
     */
    truthTable() {
      const ins = this.inputNodes();
      const outs = this.outputNodes();
      const n = ins.length;
      const rows = [];
      for (let i = 0; i < (1 << n); i++) {
        const vals = {};
        const bits = [];
        ins.forEach((nd, k) => {
          const b = (i >> (n - 1 - k)) & 1;
          bits.push(b);
          vals[nd.label] = b;
        });
        const r = this.evaluate(vals);
        rows.push({ in: bits, out: outs.map(o => r.value.get(o.id)) });
      }
      return { inputs: ins.map(n2 => n2.label), outputs: outs.map(n2 => n2.label), rows: rows };
    }

    /* ---------- 保存・復元 ---------- */
    toJSON() {
      return {
        nodes: [...this.nodes.values()].map(n => ({
          id: n.id, kind: n.kind, type: n.type, x: Math.round(n.x), y: Math.round(n.y),
          label: n.label, value: n.value, fixed: n.fixed
        })),
        wires: [...this.wires.values()].map(w => ({ id: w.id, from: w.from, to: w.to, port: w.port }))
      };
    }

    static fromJSON(obj) {
      const c = new Circuit();
      if (!obj || !obj.nodes) return c;
      obj.nodes.forEach(n => {
        if (n.kind === 'gate' && !GATES[n.type]) return;
        c.nodes.set(n.id, {
          id: n.id, kind: n.kind, type: n.type, x: n.x, y: n.y,
          label: n.label, value: n.value ? 1 : 0, fixed: !!n.fixed
        });
      });
      (obj.wires || []).forEach(w => {
        if (c.nodes.has(w.from) && c.nodes.has(w.to)) c.wires.set(w.id, { id: w.id, from: w.from, to: w.to, port: w.port });
      });
      return c;
    }

    /** 出力ラベル → ビット列（"0110" など）。未確定は '-'。 */
    outputBits() {
      const tt = this.truthTable();
      const res = {};
      tt.outputs.forEach((label, k) => {
        res[label] = tt.rows.map(r => (r.out[k] === null || r.out[k] === undefined) ? '-' : String(r.out[k])).join('');
      });
      return res;
    }
  }

  function byLabel(a, b) { return a.label < b.label ? -1 : a.label > b.label ? 1 : 0; }

  /* ---------- 論理式の生成 ---------- */
  const PREC = { atom: 4, and: 3, xor: 2, or: 1 };

  /** 回路構造をそのまま論理式（HTML）に変換する */
  function structureExpr(circ, nodeId, depth) {
    depth = depth || 0;
    if (depth > 60) return { html: '…', prec: PREC.atom };
    const n = circ.nodes.get(nodeId);
    if (!n) return null;
    if (n.kind === 'in') return { html: n.label, prec: PREC.atom };

    const k = arity(n);
    const subs = [];
    for (let p = 0; p < k; p++) {
      const w = circ.wireInto(nodeId, p);
      if (!w) return null;
      const s = structureExpr(circ, w.from, depth + 1);
      if (!s) return null;
      subs.push(s);
    }
    if (n.kind === 'out') return subs[0];

    const wrap = (s, need) => (s.prec < need ? '(' + s.html + ')' : s.html);
    switch (n.type) {
      case 'AND':  return { html: wrap(subs[0], PREC.and) + ' · ' + wrap(subs[1], PREC.and), prec: PREC.and };
      case 'OR':   return { html: wrap(subs[0], PREC.or) + ' + ' + wrap(subs[1], PREC.or), prec: PREC.or };
      case 'XOR':  return { html: wrap(subs[0], PREC.xor) + ' ⊕ ' + wrap(subs[1], PREC.xor), prec: PREC.xor };
      case 'NOT':  return { html: ov(subs[0].html), prec: PREC.atom };
      case 'NAND': return { html: ov(wrap(subs[0], PREC.and) + ' · ' + wrap(subs[1], PREC.and)), prec: PREC.atom };
      case 'NOR':  return { html: ov(wrap(subs[0], PREC.or) + ' + ' + wrap(subs[1], PREC.or)), prec: PREC.atom };
      case 'XNOR': return { html: ov(wrap(subs[0], PREC.xor) + ' ⊕ ' + wrap(subs[1], PREC.xor)), prec: PREC.atom };
      default: return null;
    }
  }

  /** 真理値表から主加法標準形（最小項の和）を作る */
  function canonicalSOP(labels, bits) {
    if (bits.indexOf('-') >= 0) return null;
    const n = labels.length;
    const terms = [];
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== '1') continue;
      const lit = [];
      for (let k = 0; k < n; k++) {
        const b = (i >> (n - 1 - k)) & 1;
        lit.push(b ? labels[k] : ov(labels[k]));
      }
      terms.push(lit.join('·'));
    }
    if (terms.length === 0) return '0';
    if (terms.length === bits.length) return '1';
    return terms.join(' + ');
  }

  global.LP.Circuit = Circuit;
  global.LP.GEOM = GEOM;
  global.LP.arity = arity;
  global.LP.portPos = portPos;
  global.LP.portOffset = portOffset;
  global.LP.sizeOf = sizeOf;
  global.LP.structureExpr = structureExpr;
  global.LP.canonicalSOP = canonicalSOP;
})(window);
