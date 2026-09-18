/* =========================================================================
 * board.js - 回路エディタ（SVG + ポインタ操作）
 *   ・パレットからゲートをドラッグして配置
 *   ・端子どうしをドラッグして配線
 *   ・入力スイッチをクリックして 0/1 を切り替え
 *   ・ごみ箱へドロップ / Delete キー / 右クリック で削除
 * ========================================================================= */
(function (global) {
  'use strict';
  const LP = global.LP;
  const GATES = LP.GATES, GEOM = LP.GEOM;

  const BW = 980, BH = 540;                 // 盤面の論理サイズ
  const TRASH = { x: BW - 118, y: BH - 86, w: 100, h: 70 };

  function cls(v) { return v === 1 ? 'v1' : v === 0 ? 'v0' : 'vx'; }

  class Board {
    constructor(svg, circuit, opts) {
      this.svg = svg;
      this.circuit = circuit;
      this.opts = opts || {};
      this.notation = this.opts.notation || 'MIL';
      this.selected = null;                  // {type:'node'|'wire', id}
      this.drag = null;
      this.values = new Map();
      this.loop = false;
      this._build();
      this.render();
    }

    /* ---------------- 初期化 ---------------- */
    _build() {
      this.svg.setAttribute('viewBox', '0 0 ' + BW + ' ' + BH);
      this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.svg.innerHTML =
        '<defs>' +
          '<pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">' +
            '<path d="M26 0 H0 V26" fill="none" stroke="rgba(30,50,80,.07)" stroke-width="1"/>' +
          '</pattern>' +
        '</defs>' +
        '<rect class="board-bg" x="0" y="0" width="' + BW + '" height="' + BH + '" fill="url(#grid)"/>' +
        '<g class="layer-wires"></g>' +
        '<g class="layer-nodes"></g>' +
        '<path class="temp-wire" d="" style="display:none"/>' +
        '<g class="trash" transform="translate(' + TRASH.x + ',' + TRASH.y + ')">' +
          '<rect class="trash-box" x="0" y="0" width="' + TRASH.w + '" height="' + TRASH.h + '" rx="12"/>' +
          '<text class="trash-icon" x="' + TRASH.w / 2 + '" y="34">🗑</text>' +
          '<text class="trash-text" x="' + TRASH.w / 2 + '" y="56">ごみ箱</text>' +
        '</g>';
      this.$wires = this.svg.querySelector('.layer-wires');
      this.$nodes = this.svg.querySelector('.layer-nodes');
      this.$temp = this.svg.querySelector('.temp-wire');
      this.$trash = this.svg.querySelector('.trash');

      this.svg.addEventListener('pointerdown', (e) => this._onDown(e));
      this.svg.addEventListener('dblclick', (e) => this._onDblClick(e));
      this.svg.addEventListener('contextmenu', (e) => this._onContext(e));
      this._onMove = (e) => this._move(e);
      this._onUp = (e) => this._up(e);
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);
    }

    /* ---------------- 座標変換 ---------------- */
    toBoard(e) {
      const m = this.svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const inv = m.inverse();
      let p;
      if (global.DOMPoint) p = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      else { const q = this.svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; p = q.matrixTransform(inv); }
      return { x: p.x, y: p.y };
    }

    /* ---------------- 描画 ---------------- */
    setNotation(n) { this.notation = n; this.render(); }

    render() {
      const res = this.circuit.evaluate(null);
      this.values = res.value;
      this.loop = res.loop;
      this.$wires.innerHTML = this._wiresSVG();
      this.$nodes.innerHTML = this._nodesSVG();
      if (this.opts.onChange) this.opts.onChange(this);
    }

    _wiresSVG() {
      let s = '';
      for (const w of this.circuit.wires.values()) {
        const a = this.circuit.nodes.get(w.from), b = this.circuit.nodes.get(w.to);
        if (!a || !b) continue;
        const p1 = LP.portPos(a, 'out', 0), p2 = LP.portPos(b, 'in', w.port);
        const d = Math.max(30, Math.abs(p2.x - p1.x) * 0.45);
        const path = 'M' + p1.x + ' ' + p1.y + ' C' + (p1.x + d) + ' ' + p1.y + ', ' + (p2.x - d) + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y;
        const v = this.values.get(a.id);
        const sel = this.selected && this.selected.type === 'wire' && this.selected.id === w.id ? ' selected' : '';
        s += '<path class="wire-hit" data-wire="' + w.id + '" d="' + path + '"/>';
        s += '<path class="wire ' + cls(v) + sel + '" data-wire="' + w.id + '" d="' + path + '"/>';
      }
      return s;
    }

    _nodesSVG() {
      let s = '';
      for (const n of this.circuit.nodes.values()) {
        s += n.kind === 'gate' ? this._gateSVG(n) : n.kind === 'in' ? this._inSVG(n) : this._outSVG(n);
      }
      return s;
    }

    _selCls(n) {
      return (this.selected && this.selected.type === 'node' && this.selected.id === n.id) ? ' selected' : '';
    }

    _gateSVG(n) {
      const g = GATES[n.type];
      const sym = LP.gateSymbol(n.type, this.notation);
      const val = this.values.get(n.id);
      const W = GEOM.gate.w, Hh = GEOM.gate.h;
      let s = '<g class="node node-gate' + this._selCls(n) + '" data-id="' + n.id + '" transform="translate(' + n.x + ',' + n.y + ')">';
      s += '<rect class="hit" x="-8" y="-16" width="' + (W + 16) + '" height="' + (Hh + 24) + '" rx="10"/>';
      s += '<text class="node-name" x="' + (W / 2) + '" y="-4">' + g.name + '</text>';
      const ys = g.inputs === 2 ? [14, 34] : [Hh / 2];
      ys.forEach((y, p) => {
        const w = this.circuit.wireInto(n.id, p);
        const v = w ? this.values.get(w.from) : null;
        s += '<line class="lead ' + cls(v) + '" x1="0" y1="' + y + '" x2="19" y2="' + y + '"/>';
      });
      s += '<line class="lead ' + cls(val) + '" x1="' + (14 + sym.right) + '" y1="' + (Hh / 2) + '" x2="' + W + '" y2="' + (Hh / 2) + '"/>';
      s += '<g class="sym" transform="translate(14,2)">' + sym.svg + '</g>';
      ys.forEach((y, p) => {
        const w = this.circuit.wireInto(n.id, p);
        const v = w ? this.values.get(w.from) : null;
        s += '<circle class="port port-in ' + cls(v) + (w ? ' connected' : '') + '" data-id="' + n.id + '" data-dir="in" data-port="' + p + '" cx="0" cy="' + y + '" r="7"/>';
      });
      s += '<circle class="port port-out ' + cls(val) + '" data-id="' + n.id + '" data-dir="out" data-port="0" cx="' + W + '" cy="' + (Hh / 2) + '" r="7"/>';
      return s + '</g>';
    }

    _inSVG(n) {
      const v = this.values.get(n.id);
      let s = '<g class="node node-in' + this._selCls(n) + (n.fixed ? ' fixed' : '') + '" data-id="' + n.id + '" transform="translate(' + n.x + ',' + n.y + ')">';
      s += '<rect class="hit" x="-8" y="-16" width="92" height="64" rx="10"/>';
      s += '<text class="node-name" x="33" y="-4">入力</text>';
      s += '<rect class="body" x="0" y="0" width="66" height="40" rx="10"/>';
      s += '<text class="pin-label" x="17" y="27">' + n.label + '</text>';
      s += '<g class="switch" data-id="' + n.id + '">';
      s += '<rect class="sw ' + (n.value ? 'on' : 'off') + '" x="34" y="7" width="26" height="26" rx="7"/>';
      s += '<text class="sw-val" x="47" y="26">' + (n.value ? 1 : 0) + '</text>';
      s += '</g>';
      s += '<line class="lead ' + cls(v) + '" x1="66" y1="20" x2="76" y2="20"/>';
      s += '<circle class="port port-out ' + cls(v) + '" data-id="' + n.id + '" data-dir="out" data-port="0" cx="76" cy="20" r="7"/>';
      return s + '</g>';
    }

    _outSVG(n) {
      const w = this.circuit.wireInto(n.id, 0);
      const v = w ? this.values.get(w.from) : null;
      let s = '<g class="node node-out' + this._selCls(n) + (n.fixed ? ' fixed' : '') + '" data-id="' + n.id + '" transform="translate(' + n.x + ',' + n.y + ')">';
      s += '<rect class="hit" x="-8" y="-16" width="92" height="64" rx="10"/>';
      s += '<text class="node-name" x="43" y="-4">出力</text>';
      s += '<line class="lead ' + cls(v) + '" x1="0" y1="20" x2="10" y2="20"/>';
      s += '<rect class="body" x="10" y="0" width="66" height="40" rx="10"/>';
      s += '<circle class="lamp ' + cls(v) + '" cx="32" cy="20" r="11"/>';
      s += '<text class="lamp-val ' + cls(v) + '" x="32" y="25">' + (v === null || v === undefined ? '' : v) + '</text>';
      s += '<text class="pin-label" x="57" y="27">' + n.label + '</text>';
      s += '<circle class="port port-in ' + cls(v) + (w ? ' connected' : '') + '" data-id="' + n.id + '" data-dir="in" data-port="0" cx="0" cy="20" r="7"/>';
      return s + '</g>';
    }

    /* ---------------- 操作 ---------------- */
    _onDown(e) {
      if (e.button === 2) return;
      const t = e.target;
      const port = t.closest ? t.closest('.port') : null;
      if (port) {
        e.preventDefault();
        this.drag = {
          mode: 'wire',
          id: port.getAttribute('data-id'),
          dir: port.getAttribute('data-dir'),
          port: +port.getAttribute('data-port'),
          moved: false
        };
        return;
      }
      const sw = t.closest ? t.closest('.switch') : null;
      if (sw) {
        e.preventDefault();
        const n = this.circuit.nodes.get(sw.getAttribute('data-id'));
        if (n) { n.value = n.value ? 0 : 1; this.render(); }
        return;
      }
      const wire = t.closest ? t.closest('[data-wire]') : null;
      if (wire) {
        e.preventDefault();
        this.select({ type: 'wire', id: wire.getAttribute('data-wire') });
        return;
      }
      const nodeEl = t.closest ? t.closest('.node') : null;
      if (nodeEl) {
        e.preventDefault();
        const n = this.circuit.nodes.get(nodeEl.getAttribute('data-id'));
        if (!n) return;
        const p = this.toBoard(e);
        this.drag = { mode: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y, moved: false, isNew: false, startX: e.clientX, startY: e.clientY, dist: 0 };
        return;
      }
      this.select(null);
    }

    /** パレットからのドラッグ開始（app.js から呼ばれる） */
    beginPaletteDrag(spec, e) {
      const p = this.toBoard(e);
      let n;
      if (spec.kind === 'gate') n = this.circuit.addGate(spec.type, 0, 0);
      else if (spec.kind === 'in') n = this.circuit.addInput(this.nextInputLabel(), 0, 0, false);
      else n = this.circuit.addOutput(this.nextOutputLabel(), 0, 0, false);
      const sz = LP.sizeOf(n);
      n.x = p.x - sz.w / 2;
      n.y = p.y - sz.h / 2;
      this._clamp(n);
      this.drag = { mode: 'node', id: n.id, dx: sz.w / 2, dy: sz.h / 2, moved: true, isNew: true, startX: e.clientX, startY: e.clientY, dist: 0 };
      this.select({ type: 'node', id: n.id });
      this.render();
    }

    nextInputLabel() {
      const used = new Set(this.circuit.inputNodes().map(n => n.label));
      for (const l of ['A', 'B', 'C', 'D', 'E']) if (!used.has(l)) return l;
      return 'X' + used.size;
    }
    nextOutputLabel() {
      const used = new Set(this.circuit.outputNodes().map(n => n.label));
      for (const l of ['Y', 'Z', 'S', 'C', 'W']) if (!used.has(l)) return l;
      return 'Y' + used.size;
    }

    _clamp(n) {
      const sz = LP.sizeOf(n);
      n.x = Math.max(6, Math.min(BW - sz.w - 6, n.x));
      n.y = Math.max(20, Math.min(BH - sz.h - 10, n.y));
    }

    _overTrash(p) {
      return p.x >= TRASH.x && p.x <= TRASH.x + TRASH.w && p.y >= TRASH.y && p.y <= TRASH.y + TRASH.h;
    }

    _move(e) {
      if (!this.drag) return;
      const p = this.toBoard(e);
      if (this.drag.mode === 'node') {
        const n = this.circuit.nodes.get(this.drag.id);
        if (!n) { this.drag = null; return; }
        n.x = p.x - this.drag.dx;
        n.y = p.y - this.drag.dy;
        this._clamp(n);
        this.drag.moved = true;
        this.drag.dist = Math.max(this.drag.dist || 0,
          Math.abs(e.clientX - (this.drag.startX || e.clientX)) + Math.abs(e.clientY - (this.drag.startY || e.clientY)));
        const del = !n.fixed && this._overTrash(p);
        this.$trash.classList.toggle('hot', del);
        this.render();
      } else if (this.drag.mode === 'wire') {
        const n = this.circuit.nodes.get(this.drag.id);
        if (!n) { this.drag = null; return; }
        const a = LP.portPos(n, this.drag.dir, this.drag.port);
        const d = Math.max(24, Math.abs(p.x - a.x) * 0.45);
        const s = this.drag.dir === 'out'
          ? 'M' + a.x + ' ' + a.y + ' C' + (a.x + d) + ' ' + a.y + ', ' + (p.x - d) + ' ' + p.y + ', ' + p.x + ' ' + p.y
          : 'M' + p.x + ' ' + p.y + ' C' + (p.x + d) + ' ' + p.y + ', ' + (a.x - d) + ' ' + a.y + ', ' + a.x + ' ' + a.y;
        this.$temp.setAttribute('d', s);
        this.$temp.style.display = '';
        this.drag.moved = true;
      }
    }

    _up(e) {
      const d = this.drag;
      this.drag = null;
      this.$temp.style.display = 'none';
      this.$trash.classList.remove('hot');
      if (!d) return;
      const p = this.toBoard(e);

      if (d.mode === 'node') {
        const n = this.circuit.nodes.get(d.id);
        if (!n) return;
        const rect = this.svg.getBoundingClientRect();
        const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
        if (!n.fixed && (this._overTrash(p) || (d.isNew && outside && (d.dist || 0) > 10))) {
          this.circuit.remove(n.id);
          this.select(null);
          this.render();
          return;
        }
        if (d.isNew && outside) { this._autoPlace(n); this.render(); return; }   // クリックだけなら空きマスへ
        if (!d.moved) this.select({ type: 'node', id: n.id });
        this.render();
        return;
      }

      if (d.mode === 'wire') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el && el.closest ? el.closest('.port') : null;
        if (!target) {
          // 端子の上で押して離しただけ → 入力側なら配線を外す
          if (!d.moved && d.dir === 'in') {
            const w = this.circuit.wireInto(d.id, d.port);
            if (w) { this.circuit.removeWire(w.id); this.render(); }
          }
          return;
        }
        const tid = target.getAttribute('data-id');
        const tdir = target.getAttribute('data-dir');
        const tport = +target.getAttribute('data-port');
        if (tid === d.id && tdir === d.dir && tport === d.port) {
          if (d.dir === 'in') {
            const w = this.circuit.wireInto(d.id, d.port);
            if (w) { this.circuit.removeWire(w.id); this.render(); }
          }
          return;
        }
        if (tdir === d.dir) { this._flash('出力どうし・入力どうしはつなげません'); return; }
        const from = d.dir === 'out' ? d.id : tid;
        const to = d.dir === 'out' ? tid : d.id;
        const port = d.dir === 'out' ? tport : d.port;
        if (from === to) { this._flash('同じ部品どうしはつなげません'); return; }
        this.circuit.connect(from, to, port);
        this.render();
      }
    }

    _onDblClick(e) {
      const nodeEl = e.target.closest ? e.target.closest('.node') : null;
      if (nodeEl) {
        const n = this.circuit.nodes.get(nodeEl.getAttribute('data-id'));
        if (n && !n.fixed) { this.circuit.remove(n.id); this.select(null); this.render(); }
      }
    }

    _onContext(e) {
      const wire = e.target.closest ? e.target.closest('[data-wire]') : null;
      const nodeEl = e.target.closest ? e.target.closest('.node') : null;
      if (wire) { e.preventDefault(); this.circuit.removeWire(wire.getAttribute('data-wire')); this.select(null); this.render(); }
      else if (nodeEl) {
        const n = this.circuit.nodes.get(nodeEl.getAttribute('data-id'));
        if (n && !n.fixed) { e.preventDefault(); this.circuit.remove(n.id); this.select(null); this.render(); }
      }
    }

    select(sel) { this.selected = sel; this.render(); }

    deleteSelected() {
      const s = this.selected;
      if (!s) { this._flash('削除するものを選んでください'); return; }
      if (s.type === 'wire') this.circuit.removeWire(s.id);
      else {
        const n = this.circuit.nodes.get(s.id);
        if (n && n.fixed) { this._flash('この部品は消せません'); return; }
        this.circuit.remove(s.id);
      }
      this.selected = null;
      this.render();
    }

    /** ゲートと配線だけを消す（入出力は残す） */
    clearGates() {
      this.circuit.gateNodes().forEach(n => this.circuit.remove(n.id));
      for (const w of [...this.circuit.wires.values()]) this.circuit.removeWire(w.id);
      this.selected = null;
      this.render();
    }

    /** 空いている場所を探して部品を置く（パレットをクリックしたとき用） */
    _autoPlace(n) {
      const sz = LP.sizeOf(n);
      const used = [...this.circuit.nodes.values()].filter(o => o.id !== n.id);
      for (let col = 0; col < 6; col++) {
        for (let row = 0; row < 6; row++) {
          const x = 250 + col * 120, y = 64 + row * 88;
          if (x + sz.w > TRASH.x - 10 && y + sz.h > TRASH.y - 10) continue;
          const hit = used.some(o => Math.abs(o.x - x) < 100 && Math.abs(o.y - y) < 60);
          if (!hit) { n.x = x; n.y = y; this._clamp(n); return; }
        }
      }
      n.x = 200; n.y = 80; this._clamp(n);
    }

    _flash(msg) { if (this.opts.onMessage) this.opts.onMessage(msg); }

    destroy() {
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
    }
  }

  LP.Board = Board;
  LP.BOARD_SIZE = { w: BW, h: BH };
})(window);
