/* =========================================================================
 * app.js - 画面全体の組み立て（タブ・パレット・ステージ進行・各パネル）
 * ========================================================================= */
(function (global) {
  'use strict';
  const LP = global.LP;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('lp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lp.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動作は継続 */ } }
  };

  let notation = store.get('notation', 'MIL');
  const cleared = new Set(store.get('cleared', []));
  let pzBoard, sbBoard, quiz, refBuilt = false;
  let stageIndex = Math.min(store.get('stage', 0), LP.STAGES.length - 1);
  let wasClear = false;

  /* ===================== パレット ===================== */
  function paletteHTML(specs) {
    return specs.map(sp => {
      if (sp.kind === 'gate') {
        const g = LP.GATES[sp.type];
        return '<button class="pal-item" data-kind="gate" data-type="' + sp.type + '" title="' + g.jp + '">' +
          '<span class="pal-sym">' + LP.standaloneSymbol(sp.type, notation, { labels: false, scale: 0.82 }) + '</span>' +
          '<span class="pal-name">' + g.name + '</span></button>';
      }
      if (sp.kind === 'in') {
        return '<button class="pal-item" data-kind="in" title="0 と 1 を切り替えるスイッチ">' +
          '<span class="pal-sym pal-chip in">A<i>1</i></span><span class="pal-name">入力スイッチ</span></button>';
      }
      return '<button class="pal-item" data-kind="out" title="結果を表示するランプ">' +
        '<span class="pal-sym pal-chip out"><i></i>Y</span><span class="pal-name">出力ランプ</span></button>';
    }).join('');
  }

  function bindPalette(el, board) {
    $$('.pal-item', el).forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        board.beginPaletteDrag({ kind: btn.getAttribute('data-kind'), type: btn.getAttribute('data-type') }, e);
      });
    });
  }

  /* ===================== パズルモード ===================== */
  function stageKey(i) { return 'circuit.' + LP.STAGES[i].id; }

  function buildStageCircuit(st) {
    const saved = store.get(stageKey(stageIndex), null);
    if (saved) {
      const c = LP.Circuit.fromJSON(saved);
      const ins = c.inputNodes().map(n => n.label).sort().join(',');
      const outs = c.outputNodes().map(n => n.label).sort().join(',');
      if (ins === st.inputs.slice().sort().join(',') && outs === st.outputs.slice().sort().join(',')) return c;
    }
    const c = new LP.Circuit();
    const B = LP.BOARD_SIZE, mid = B.h / 2 - 20;
    const ih = st.inputs.length, oh = st.outputs.length;
    st.inputs.forEach((l, i) => c.addInput(l, 40, Math.round(mid - (ih - 1) * 58 + i * 116), true));
    st.outputs.forEach((l, i) => c.addOutput(l, B.w - 100, Math.round(mid - (oh - 1) * 66 + i * 132), true));
    return c;
  }

  function loadStage(i) {
    stageIndex = (i + LP.STAGES.length) % LP.STAGES.length;
    store.set('stage', stageIndex);
    const st = LP.STAGES[stageIndex];
    wasClear = false;

    $('#pzChapter').textContent = st.chapter;
    $('#pzTitle').innerHTML = 'STAGE ' + (stageIndex + 1) + '. ' + st.title;
    $('#pzPalette').innerHTML = paletteHTML(st.gates.map(t => ({ kind: 'gate', type: t })));

    pzBoard.circuit = buildStageCircuit(st);
    pzBoard.selected = null;
    pzBoard.resetView();
    bindPalette($('#pzPalette'), pzBoard);

    /* 目標パネル */
    let h = '<p class="stage-desc">' + st.desc + '</p>';
    h += '<div class="target-venns"></div>';
    h += '<div class="hint-box"><button class="btn ghost small" id="hintBtn">💡 ヒントを見る</button>' +
         '<p class="hint" id="hintText" hidden>' + st.hint + '</p></div>';
    $('#pzTargetBody').innerHTML = h;

    const vh = $('.target-venns', $('#pzTargetBody'));
    if (st.inputs.length <= 3) {
      st.outputs.forEach(l => {
        const box = document.createElement('div');
        box.className = 'venn-box';
        box.innerHTML = '<div class="venn-cap">目標のベン図：' + l + '</div>';
        box.appendChild(LP.venn.make(st.inputs, st.target[l], { w: 190, h: 124 }));
        vh.appendChild(box);
      });
    }
    $('#hintBtn').addEventListener('click', (e) => {
      const t = $('#hintText');
      t.hidden = !t.hidden;
      e.target.textContent = t.hidden ? '💡 ヒントを見る' : '💡 ヒントを隠す';
    });

    renderStageList();
    pzBoard.render();
  }

  function onPuzzleChange(board) {
    const st = LP.STAGES[stageIndex];
    const tt = board.circuit.truthTable();
    $('#pzTable').innerHTML = '<h3>真理値表（目標とくらべる）</h3>' + LP.tables.circuitTable(tt, st.target);

    const bits = board.circuit.outputBits();
    const unresolved = st.outputs.some(l => (bits[l] || '').indexOf('-') >= 0);
    const ok = !board.loop && st.outputs.every(l => bits[l] === st.target[l]);
    const used = board.circuit.gateCount();

    let msg, cl;
    if (board.loop) { msg = '⚠ 配線がループしています。出力から自分自身に戻る線を外してください。'; cl = 'warn'; }
    else if (unresolved) { msg = 'つながっていない入力があります。すべての端子をつなぎましょう。'; cl = 'info'; }
    else if (ok) { msg = '🎉 クリア！ 目標の真理値表と完全に一致しました。'; cl = 'ok'; }
    else { msg = 'まだ一致していません。真理値表の ✕ の行を見直してみましょう。'; cl = 'ng'; }

    const star = ok && used <= st.minGates ? ' <span class="star">★ 最小ゲート数を達成！</span>' : '';
    $('#pzMsg').className = 'board-foot ' + cl;
    $('#pzMsg').innerHTML = '<span class="msg">' + msg + '</span>' +
      '<span class="gcount">使用ゲート ' + used + ' 個（目安 ' + st.minGates + ' 個）' + star + '</span>';

    store.set(stageKey(stageIndex), board.circuit.toJSON());

    if (ok && !wasClear) {
      wasClear = true;
      if (!cleared.has(st.id)) { cleared.add(st.id); store.set('cleared', [...cleared]); renderStageList(); }
      showClear(st);
    } else if (!ok) {
      wasClear = false;
    }
  }

  function showClear(st) {
    const last = stageIndex === LP.STAGES.length - 1;
    openModal(
      '<div class="clear-modal">' +
      '<p class="clear-badge">STAGE ' + (stageIndex + 1) + ' CLEAR!</p>' +
      '<h2>' + st.title + '</h2>' +
      '<p class="lesson"><b>学びのポイント</b><br>' + st.lesson + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-close>回路を見直す</button>' +
      (last ? '' : '<button class="btn primary" id="toNext">つぎのステージへ →</button>') +
      '</div></div>'
    );
    const nx = $('#toNext');
    if (nx) nx.addEventListener('click', () => { closeModal(); loadStage(stageIndex + 1); });
  }

  function renderStageList() {
    const done = LP.STAGES.filter(s => cleared.has(s.id)).length;
    $('#progressText').textContent = done + ' / ' + LP.STAGES.length + ' クリア';
    $('#progressBar').style.width = (done / LP.STAGES.length * 100) + '%';

    const box = $('#stageList');   // ステージ一覧はモーダル表示中のみ存在する
    if (!box) return;
    let h = '';
    let chapter = '';
    LP.STAGES.forEach((s, i) => {
      if (s.chapter !== chapter) { chapter = s.chapter; h += '<div class="chap">' + chapter + '</div>'; }
      h += '<button class="stage-chip' + (i === stageIndex ? ' now' : '') + (cleared.has(s.id) ? ' done' : '') +
           '" data-i="' + i + '"><span class="num">' + (i + 1) + '</span><span class="nm">' + s.title + '</span>' +
           (cleared.has(s.id) ? '<span class="check">✓</span>' : '') + '</button>';
    });
    box.innerHTML = h;
    $$('.stage-chip', box).forEach(b => b.addEventListener('click', () => {
      closeModal();
      loadStage(+b.getAttribute('data-i'));
    }));
  }

  /* ===================== じゆう工作モード ===================== */
  function onSandboxChange(board) {
    const c = board.circuit;
    const foot = $('#sbFoot');
    if (board.loop) {
      foot.className = 'board-foot warn';
      foot.innerHTML = '<span class="msg">⚠ 配線がぐるりと一周しています（出力が自分自身に戻っています）。値が決まらないので、線を 1 本外してください。</span>';
    } else {
      foot.className = 'board-foot';
      foot.innerHTML = '<span class="msg">入力スイッチ・出力ランプも自由に増やせます（入力は最大 5 個、ベン図は 3 個まで）。</span>';
    }
    const tt = c.truthTable();
    $('#sbTable').innerHTML = '<h3>真理値表</h3>' + LP.tables.circuitTable(tt, null);

    /* ベン図 */
    const vb = $('#sbVenn');
    vb.innerHTML = '<h3>ベン図</h3>';
    const bits = c.outputBits();
    if (tt.inputs.length === 0 || tt.inputs.length > 3) {
      vb.innerHTML += '<p class="empty">ベン図は入力 1〜3 個のときに表示されます。</p>';
    } else if (tt.outputs.length === 0) {
      vb.innerHTML += '<p class="empty">出力ランプを置いてください。</p>';
    } else {
      tt.outputs.forEach(l => {
        const b = bits[l] || '';
        const box = document.createElement('div');
        box.className = 'venn-box';
        box.innerHTML = '<div class="venn-cap">出力 ' + l + (b.indexOf('-') >= 0 ? '（未接続の入力があります）' : '') + '</div>';
        box.appendChild(LP.venn.make(tt.inputs, b.replace(/-/g, '0'), { w: 200, h: 130 }));
        vb.appendChild(box);
      });
    }

    /* 論理式 */
    let h = '<h3>論理式</h3>';
    if (tt.outputs.length === 0) h += '<p class="empty">出力ランプを置くと論理式が出ます。</p>';
    else {
      c.outputNodes().forEach(o => {
        const e = LP.structureExpr(c, o.id, 0);
        const sop = LP.canonicalSOP(tt.inputs, bits[o.label] || '');
        h += '<div class="expr-box">';
        h += '<div class="expr-row"><span class="expr-cap">回路のとおり</span><span class="expr">' +
             o.label + ' = ' + (e ? e.html : '<span class="dim">（配線が足りません）</span>') + '</span></div>';
        if (sop !== null) h += '<div class="expr-row"><span class="expr-cap">主加法標準形</span><span class="expr">' + o.label + ' = ' + sop + '</span></div>';
        h += '</div>';
      });
    }
    $('#sbExpr').innerHTML = h;

    store.set('sandbox', c.toJSON());
  }

  function defaultSandbox() {
    const c = new LP.Circuit();
    c.addInput('A', 40, 150, false);
    c.addInput('B', 40, 300, false);
    const g = c.addGate('AND', 340, 201);
    const o = c.addOutput('Y', 700, 205, false);
    const a = c.inputNodes()[0], b = c.inputNodes()[1];
    c.connect(a.id, g.id, 0);
    c.connect(b.id, g.id, 1);
    c.connect(g.id, o.id, 0);
    return c;
  }

  /* ===================== モーダル ===================== */
  function openModal(html) {
    const m = $('#modal');
    $('#modalBody').innerHTML = html;
    m.hidden = false;
    $$('[data-close]', m).forEach(b => b.addEventListener('click', closeModal));
  }
  function closeModal() { $('#modal').hidden = true; }

  const HELP = '<h2>遊び方</h2>' +
    '<div class="help-grid">' +
    '<div><b>① 部品を置く</b><p>左のパレットから盤面へ<b>ドラッグ＆ドロップ</b>します。クリックだけでも空いている場所に置かれます。</p></div>' +
    '<div><b>② 線でつなぐ</b><p>部品の丸い端子から、つなぎたい相手の端子へ<b>ドラッグ</b>します。出力（右側）と入力（左側）だけがつながります。1 つの出力から何本にも分岐できます。</p></div>' +
    '<div><b>③ スイッチを押す</b><p>入力ブロックの四角い 0 / 1 をクリックすると値が変わり、線と出力ランプの色がその場で変化します。</p></div>' +
    '<div><b>④ 消す</b><p>部品を<b>ごみ箱へドラッグ</b>、または<b>ダブルクリック</b>／<b>右クリック</b>。線はクリックして選び Delete キー、または右クリックで消せます。</p></div>' +
    '<div><b>⑤ 結果を読む</b><p>右側の<b>真理値表</b>・<b>ベン図</b>・<b>論理式</b>は、回路を変えるたびに自動で作り直されます。真理値表は全部の入力の組み合わせを一気に計算しています。</p></div>' +
    '<div><b>⑥ 記号の流派</b><p>右上で <b>MIL 記号</b>（特殊形状）と <b>JIS 記号</b>（長方形）を切り替えられます。教科書に合わせて選んでください。</p></div>' +
    '<div><b>⑦ 拡大・移動</b><p>スマホ・タブレットでは<b>2 本指のピンチ</b>で拡大縮小、<b>背景を 1 本指でなぞる</b>と画面が動きます。パソコンでは盤面左下の <b>＋ − ⟲</b> ボタン、<b>Ctrl（⌘）＋ホイール</b>、<b>背景のドラッグ</b>が使えます。</p></div>' +
    '</div><div class="modal-actions"><button class="btn primary" data-close>とじる</button></div>';

  /* ===================== タブ ===================== */
  function showView(v) {
    $$('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
    $$('.tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === v));
    store.set('view', v);
    if (v === 'ref' && !refBuilt) { LP.reference.build($('#view-ref'), notation); refBuilt = true; }
    if (v === 'quiz' && !quiz) quiz = new LP.Quiz($('#view-quiz'), () => notation);
  }

  function setNotation(n) {
    notation = n;
    store.set('notation', n);
    $$('#notation button').forEach(b => b.classList.toggle('on', b.getAttribute('data-n') === n));
    pzBoard.setNotation(n);
    sbBoard.setNotation(n);
    $('#pzPalette').innerHTML = paletteHTML(LP.STAGES[stageIndex].gates.map(t => ({ kind: 'gate', type: t })));
    bindPalette($('#pzPalette'), pzBoard);
    $('#sbPalette').innerHTML = paletteHTML(sandboxSpecs());
    bindPalette($('#sbPalette'), sbBoard);
    refBuilt = false;
    if (!$('#view-ref').hidden) { LP.reference.build($('#view-ref'), notation); refBuilt = true; }
  }

  function sandboxSpecs() {
    return [{ kind: 'in' }, { kind: 'out' }].concat(LP.GATE_ORDER.map(t => ({ kind: 'gate', type: t })));
  }

  /* ===================== 起動 ===================== */
  function init() {
    pzBoard = new LP.Board($('#pzBoard'), new LP.Circuit(), {
      notation: notation,
      onChange: onPuzzleChange,
      onMessage: (m) => { $('#pzMsg').className = 'board-foot warn'; $('#pzMsg').innerHTML = '<span class="msg">' + m + '</span>'; }
    });
    const saved = store.get('sandbox', null);
    sbBoard = new LP.Board($('#sbBoard'), saved ? LP.Circuit.fromJSON(saved) : defaultSandbox(), {
      notation: notation,
      onChange: onSandboxChange,
      onMessage: (m) => { $('#sbMsg').textContent = m; }
    });

    $('#sbPalette').innerHTML = paletteHTML(sandboxSpecs());
    bindPalette($('#sbPalette'), sbBoard);
    loadStage(stageIndex);

    $$('.tab').forEach(b => b.addEventListener('click', () => showView(b.getAttribute('data-view'))));
    $$('#notation button').forEach(b => b.addEventListener('click', () => setNotation(b.getAttribute('data-n'))));
    $('#helpBtn').addEventListener('click', () => openModal(HELP));
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

    $('#pzPrev').addEventListener('click', () => loadStage(stageIndex - 1));
    $('#pzNext').addEventListener('click', () => loadStage(stageIndex + 1));
    $('#pzListBtn').addEventListener('click', () => {
      openModal('<h2>ステージ一覧</h2><div class="stage-list" id="stageList"></div>' +
                '<div class="modal-actions"><button class="btn ghost" data-close>とじる</button></div>');
      renderStageList();
    });
    $('#pzDelete').addEventListener('click', () => pzBoard.deleteSelected());
    $('#pzClear').addEventListener('click', () => pzBoard.clearGates());
    $('#sbDelete').addEventListener('click', () => sbBoard.deleteSelected());
    $('#sbClear').addEventListener('click', () => {
      sbBoard.circuit = new LP.Circuit();
      sbBoard.selected = null;
      sbBoard.resetView();
      sbBoard.render();
    });
    $('#sbReset').addEventListener('click', () => {
      sbBoard.circuit = defaultSandbox();
      sbBoard.selected = null;
      sbBoard.resetView();
      sbBoard.render();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (!$('#view-puzzle').hidden) pzBoard.deleteSelected();
      else if (!$('#view-sandbox').hidden) sbBoard.deleteSelected();
    });

    $$('#notation button').forEach(b => b.classList.toggle('on', b.getAttribute('data-n') === notation));
    showView(store.get('view', 'puzzle'));
    renderStageList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
