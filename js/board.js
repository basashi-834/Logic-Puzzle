/* =========================================================================
 * board.js - 回路エディタ（SVG + ポインタ操作）
 *   ・パレットからゲートをドラッグして配置
 *   ・端子どうしをドラッグして配線
 *   ・入力スイッチをクリックして 0/1 を切り替え
 *   ・ごみ箱へドロップ / Delete キー / 右クリック で削除
 *   ・2 本指ピンチで拡大縮小、1 本指（背景）で画面移動。Ctrl+ホイールでも拡大縮小
 * ========================================================================= */
(function (global) {
  'use strict';
  const LP = global.LP;
  const GATES = LP.GATES, GEOM = LP.GEOM;

  const BW = 980, BH = 540;                 // 盤面の論理サイズ
  const TRASH = { x: BW - 118, y: BH - 86, w: 100, h: 70 };
  const MIN_K = 0.6, MAX_K = 4;             // 拡大率の下限・上限

  function cls(v) { return v === 1 ? 'v1' : v === 0 ? 'v0' : 'vx'; }

  class Board {
    constructor(svg, circuit, opts) {
      this.svg = svg;
      this.circuit = circuit;
      this.opts = opts || {};
      this.notation = this.opts.notation || 'MIL';
      this.selected = null;                  // {type:'node'|'wire', id}
      this.drag = null;
      this.view = { x: 0, y: 0, k: 1 };      // 盤面の表示位置と拡大率
      this.pointers = new Map();             // 画面に触れているポインタ
      this.pinch = null;
      this.armed = null;                     // タップでつなぐときの「つなぎ元」端子
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
        '<rect class="board-outer" x="-2000" y="-2000" width="5000" height="5000"/>' +
        '<g class="viewport">' +
          '<rect class="board-paper" x="0" y="0" width="' + BW + '" height="' + BH + '"/>' +
          '<rect class="board-bg" x="0" y="0" width="' + BW + '" height="' + BH + '" fill="url(#grid)"/>' +
          '<g class="layer-wires"></g>' +
          '<g class="layer-nodes"></g>' +
          '<path class="temp-wire" d="" style="display:none"/>' +
        '</g>' +
        '<g class="trash" transform="translate(' + TRASH.x + ',' + TRASH.y + ')">' +
          '<rect class="trash-box" x="0" y="0" width="' + TRASH.w + '" height="' + TRASH.h + '" rx="12"/>' +
          '<text class="trash-icon" x="' + TRASH.w / 2 + '" y="34">🗑</text>' +
          '<text class="trash-text" x="' + TRASH.w / 2 + '" y="56">ごみ箱</text>' +
        '</g>';
      this.$view = this.svg.querySelector('.viewport');
      this.$wires = this.svg.querySelector('.layer-wires');
      this.$nodes = this.svg.querySelector('.layer-nodes');
      this.$temp = this.svg.querySelector('.temp-wire');
      this.$trash = this.svg.querySelector('.trash');

      this.svg.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      this.svg.addEventListener('pointerdown', (e) => this._onDown(e));
      this.svg.addEventListener('dblclick', (e) => this._onDblClick(e));
      this.svg.addEventListener('contextmenu', (e) => this._onContext(e));
      this._onMove = (e) => this._move(e);
      this._onUp = (e) => this._up(e);
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);
      this._buildZoomUI();
      this._applyView();
    }

    /* ---------------- 画面上の案内バー ---------------- */
    hint(msg, kind) {
      if (!this.$hint) return;
      clearTimeout(this._hintTimer);
      if (!msg) { this.$hint.hidden = true; return; }
      this.$hint.className = 'board-hint' + (kind ? ' ' + kind : '');
      this.$hint.innerHTML = msg;
      this.$hint.hidden = false;
      if (kind) this._hintTimer = setTimeout(() => { if (!this.armed) this.$hint.hidden = true; }, 2600);
    }

    /* ---------------- 拡大縮小・画面移動 ---------------- */
    _buildZoomUI() {
      const wrap = this.svg.parentNode;
      if (!wrap) return;
      this.$hint = document.createElement('div');
      this.$hint.className = 'board-hint';
      this.$hint.hidden = true;
      wrap.appendChild(this.$hint);
      const el = document.createElement('div');
      el.className = 'board-zoom';
      el.innerHTML =
        '<button type="button" data-z="out" title="縮小">−</button>' +
        '<span class="zoom-pct">100%</span>' +
        '<button type="button" data-z="in" title="拡大">＋</button>' +
        '<button type="button" data-z="fit" title="全体表示に戻す">⟲</button>';
      wrap.appendChild(el);
      this.$zoomPct = el.querySelector('.zoom-pct');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const z = b.getAttribute('data-z');
        if (z === 'fit') this.resetView();
        else this.zoomAt({ x: BW / 2, y: BH / 2 }, z === 'in' ? 1.25 : 0.8);
      });
    }

    _applyView() {
      const v = this.view;
      v.k = Math.min(MAX_K, Math.max(MIN_K, v.k));
      const m = 0.3;                                    // 盤面が最低 3 割は見えるように制限する
      v.x = Math.min(BW * (1 - m), Math.max(BW * m - BW * v.k, v.x));
      v.y = Math.min(BH * (1 - m), Math.max(BH * m - BH * v.k, v.y));
      this.$view.setAttribute('transform', 'translate(' + v.x.toFixed(2) + ',' + v.y.toFixed(2) + ') scale(' + v.k.toFixed(4) + ')');
      if (this.$zoomPct) this.$zoomPct.textContent = Math.round(v.k * 100) + '%';
    }

    /** SVG 座標 p を固定したまま拡大率を factor 倍する */
    zoomAt(p, factor) {
      const k0 = this.view.k;
      const k = Math.min(MAX_K, Math.max(MIN_K, k0 * factor));
      if (k === k0) return;
      this.view.x = p.x - (p.x - this.view.x) * (k / k0);
      this.view.y = p.y - (p.y - this.view.y) * (k / k0);
      this.view.k = k;
      this._applyView();
    }

    resetView() { this._disarm(); this.view = { x: 0, y: 0, k: 1 }; this._applyView(); }

    _onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;             // 通常のホイールはページ送りのまま
      e.preventDefault();
      this.zoomAt(this.toSvg(e), Math.pow(0.99, e.deltaY));
    }

    _beginPan(e) {
      const p = this.toSvg(e);
      this.drag = { mode: 'pan', sx: p.x, sy: p.y, vx: this.view.x, vy: this.view.y, moved: false };
    }

    _beginPinch() {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;
      this.drag = null;
      this.$temp.style.display = 'none';
      this.$trash.classList.remove('hot');
      const [a, b] = pts;
      this.pinch = {
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        k0: this.view.k, x0: this.view.x, y0: this.view.y
      };
    }

    _pinchMove() {
      const pts = [...this.pointers.values()];
      if (pts.length < 2 || !this.pinch) return;
      const [a, b] = pts;
      const p = this.pinch;
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = Math.min(MAX_K, Math.max(MIN_K, p.k0 * d / p.d0));
      this.view.k = k;
      this.view.x = mid.x - ((p.mid0.x - p.x0) / p.k0) * k;   // 指の中心にある点を動かさない
      this.view.y = mid.y - ((p.mid0.y - p.y0) / p.k0) * k;
      this._applyView();
    }

    /** いま画面に見えている範囲（盤面座標） */
    _visibleRect() {
      const v = this.view;
      return { x: -v.x / v.k, y: -v.y / v.k, w: BW / v.k, h: BH / v.k };
    }

    /* ---------------- 座標変換 ---------------- */
    _toLocal(el, e) {
      const m = el.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const inv = m.inverse();
      let p;
      if (global.DOMPoint) p = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      else { const q = this.svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; p = q.matrixTransform(inv); }
      return { x: p.x, y: p.y };
    }

    /** 部品の座標系（拡大縮小・移動の影響を受ける） */
    toBoard(e) { return this._toLocal(this.$view, e); }

    /** 画面に固定された座標系（ごみ箱の判定などに使う） */
    toSvg(e) { return this._toLocal(this.svg, e); }

    /* ---------------- 描画 ---------------- */
    setNotation(n) { this.notation = n; this.render(); }

    render() {
      if (this.armed && !this.circuit.nodes.has(this.armed.id)) this._disarm();
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

    /** 選択中（つなぎ元として待機中）の端子か */
    _armedCls(id, dir, port) {
      const a = this.armed;
      return (a && a.id === id && a.dir === dir && a.port === port) ? ' armed' : '';
    }

    /** 指でも押せる広さの端子エリア（見た目は透明） */
    _portZone(id, dir, port, x, y, w, h) {
      return '<rect class="port port-zone" data-id="' + id + '" data-dir="' + dir + '" data-port="' + port +
             '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9"/>';
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
      // 端子エリア（入力は上下に分割、出力は右端）
      if (g.inputs === 2) {
        s += this._portZone(n.id, 'in', 0, -14, -10, 40, 34);
        s += this._portZone(n.id, 'in', 1, -14, 24, 40, 34);
      } else {
        s += this._portZone(n.id, 'in', 0, -14, -6, 40, 60);
      }
      s += this._portZone(n.id, 'out', 0, 78, -6, 36, 60);
      ys.forEach((y, p) => {
        const w = this.circuit.wireInto(n.id, p);
        const v = w ? this.values.get(w.from) : null;
        s += '<circle class="port port-in ' + cls(v) + (w ? ' connected' : '') + this._armedCls(n.id, 'in', p) +
             '" data-id="' + n.id + '" data-dir="in" data-port="' + p + '" cx="0" cy="' + y + '" r="7"/>';
      });
      s += '<circle class="port port-out ' + cls(val) + this._armedCls(n.id, 'out', 0) +
           '" data-id="' + n.id + '" data-dir="out" data-port="0" cx="' + W + '" cy="' + (Hh / 2) + '" r="7"/>';
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
      s += this._portZone(n.id, 'out', 0, 62, -6, 34, 52);
      s += '<circle class="port port-out ' + cls(v) + this._armedCls(n.id, 'out', 0) +
           '" data-id="' + n.id + '" data-dir="out" data-port="0" cx="76" cy="20" r="7"/>';
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
      s += this._portZone(n.id, 'in', 0, -16, -6, 34, 52);
      s += '<circle class="port port-in ' + cls(v) + (w ? ' connected' : '') + this._armedCls(n.id, 'in', 0) +
           '" data-id="' + n.id + '" data-dir="in" data-port="0" cx="0" cy="20" r="7"/>';
      return s + '</g>';
    }

    /* ---------------- 操作 ---------------- */
    _onDown(e) {
      if (e.button === 2) return;
      this.pointers.set(e.pointerId, this.toSvg(e));
      if (this.pointers.size === 2) { e.preventDefault(); this._beginPinch(); return; }   // 2 本指はピンチ
      if (this.pointers.size > 2) return;
      if (e.button === 1) { e.preventDefault(); this._beginPan(e); return; }              // 中ボタンで画面移動
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
      e.preventDefault();
      this._beginPan(e);          // 背景のドラッグは画面移動（動かさずに離せば選択解除）
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
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, this.toSvg(e));
      if (this.pinch) { this._pinchMove(); return; }
      if (!this.drag) return;
      if (this.drag.mode === 'pan') {
        const q = this.toSvg(e);
        this.view.x = this.drag.vx + (q.x - this.drag.sx);
        this.view.y = this.drag.vy + (q.y - this.drag.sy);
        if (Math.abs(q.x - this.drag.sx) + Math.abs(q.y - this.drag.sy) > 4) this.drag.moved = true;
        this._applyView();
        return;
      }
      const p = this.toBoard(e);
      if (this.drag.mode === 'node') {
        const n = this.circuit.nodes.get(this.drag.id);
        if (!n) { this.drag = null; return; }
        n.x = p.x - this.drag.dx;
        n.y = p.y - this.drag.dy;
        this._clamp(n);
        if (!this.drag.moved) this._disarm();
        this.drag.moved = true;
        this.drag.dist = Math.max(this.drag.dist || 0,
          Math.abs(e.clientX - (this.drag.startX || e.clientX)) + Math.abs(e.clientY - (this.drag.startY || e.clientY)));
        const del = !n.fixed && this._overTrash(this.toSvg(e));
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
      this.pointers.delete(e.pointerId);
      if (this.pinch) {
        if (this.pointers.size < 2) this.pinch = null;
        this.drag = null;
        return;
      }
      const d = this.drag;
      this.drag = null;
      this.$temp.style.display = 'none';
      this.$trash.classList.remove('hot');
      if (!d) return;

      if (d.mode === 'pan') {
        if (!d.moved) { this._disarm(); this.select(null); }
        return;
      }
      const p = this.toBoard(e);

      if (d.mode === 'node') {
        const n = this.circuit.nodes.get(d.id);
        if (!n) return;
        const rect = this.svg.getBoundingClientRect();
        const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
        if (!n.fixed && (this._overTrash(this.toSvg(e)) || (d.isNew && outside && (d.dist || 0) > 10))) {
          this.circuit.remove(n.id);
          this.select(null);
          this.render();
          return;
        }
        if (d.isNew && outside) { this._autoPlace(n); this.render(); return; }   // クリックだけなら空きマスへ
        if (!d.moved) {
          // つなぎ元が待機中なら、部品本体をタップするだけでつながる
          if (this.armed && this.armed.id !== n.id) { this._connectToNode(n); return; }
          this._disarm();
          this.select({ type: 'node', id: n.id });
        }
        this.render();
        return;
      }

      if (d.mode === 'wire') {
        if (!d.moved) { this._tapPort(d); return; }          // ドラッグせず離した＝タップ
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el && el.closest ? el.closest('.port') : null;
        if (!target) { this._disarm(); this.render(); return; }
        const t = {
          id: target.getAttribute('data-id'),
          dir: target.getAttribute('data-dir'),
          port: +target.getAttribute('data-port')
        };
        if (t.id === d.id && t.dir === d.dir && t.port === d.port) { this.render(); return; }
        this._connect(d, t);
      }
    }

    /* ---------------- タップでつなぐ ---------------- */
    _disarm() { if (this.armed) { this.armed = null; this.hint(null); } }

    /** 端子をタップしたとき */
    _tapPort(p) {
      const a = this.armed;
      if (a && a.id === p.id && a.dir === p.dir && a.port === p.port) {
        // 同じ端子をもう一度タップ → 待機を取り消し（つながっていれば線を外す）
        this._disarm();
        if (p.dir === 'in') {
          const w = this.circuit.wireInto(p.id, p.port);
          if (w) { this.circuit.removeWire(w.id); this.hint('線を外しました', 'info'); }
        }
        this.render();
        return;
      }
      if (a) { this._connect(a, p); return; }
      this.armed = { id: p.id, dir: p.dir, port: p.port };
      this.select(null);
      this.hint(p.dir === 'out'
        ? 'つなぎ先の<b>入力（左）</b>をタップ　―　部品の本体でも OK'
        : 'つなぎ元の<b>出力（右）</b>をタップ　―　部品の本体でも OK');
      this.render();
    }

    /** 待機中の端子と、タップされた部品本体をつなぐ */
    _connectToNode(n) {
      const a = this.armed;
      if (!a) return;
      if (a.dir === 'out') {
        if (n.kind === 'in') { this.hint('入力スイッチには線を入れられません', 'warn'); this.render(); return; }
        const k = LP.arity(n);
        let port = 0;
        for (let q = 0; q < k; q++) if (!this.circuit.wireInto(n.id, q)) { port = q; break; }
        this._connect(a, { id: n.id, dir: 'in', port: port });
      } else {
        if (n.kind === 'out') { this.hint('出力ランプからは線を出せません', 'warn'); this.render(); return; }
        this._connect(a, { id: n.id, dir: 'out', port: 0 });
      }
    }

    /** 2 つの端子をつなぐ（向きが同じならつなぎ元を持ち替える） */
    _connect(a, b) {
      if (a.dir === b.dir) {                       // 出力どうし・入力どうし → 持ち替え
        this.armed = { id: b.id, dir: b.dir, port: b.port };
        this.hint(b.dir === 'out' ? 'つなぎ元を持ち替えました　―　つなぎ先の<b>入力</b>をタップ'
                                  : 'つなぎ先を持ち替えました　―　つなぎ元の<b>出力</b>をタップ');
        this.render();
        return;
      }
      if (a.id === b.id) { this._disarm(); this.hint('同じ部品どうしはつなげません', 'warn'); this.render(); return; }
      if (!this.circuit.nodes.has(a.id) || !this.circuit.nodes.has(b.id)) { this._disarm(); this.render(); return; }
      const from = a.dir === 'out' ? a.id : b.id;
      const to   = a.dir === 'out' ? b.id : a.id;
      const port = a.dir === 'out' ? b.port : a.port;
      this.circuit.connect(from, to, port);
      this._disarm();
      this.render();
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
      const vis = this._visibleRect();
      const x0 = Math.max(vis.x + 30, 160), y0 = Math.max(vis.y + 24, 40);
      for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
          const x = x0 + col * 120, y = y0 + row * 88;
          if (x + sz.w > vis.x + vis.w || y + sz.h > vis.y + vis.h) continue;
          if (x + sz.w > TRASH.x - 10 && y + sz.h > TRASH.y - 10) continue;
          const hit = used.some(o => Math.abs(o.x - x) < 100 && Math.abs(o.y - y) < 60);
          if (!hit) { n.x = x; n.y = y; this._clamp(n); return; }
        }
      }
      n.x = x0; n.y = y0; this._clamp(n);
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
