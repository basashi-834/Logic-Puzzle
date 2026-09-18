/* =========================================================================
 * quiz.js - 4択クイズ（記号・真理値表・ベン図・論理式の相互変換）
 * ========================================================================= */
(function (global) {
  'use strict';
  const LP = global.LP;
  const ov = LP.ov;
  const N_Q = 10;

  /* 2 変数の代表的な論理式のプール（bits は AB = 00,01,10,11 の順） */
  const POOL = [
    { html: 'A · B', bits: '0001', note: 'AND（積集合）' },
    { html: 'A + B', bits: '0111', note: 'OR（和集合）' },
    { html: ov('A · B'), bits: '1110', note: 'NAND' },
    { html: ov('A + B'), bits: '1000', note: 'NOR' },
    { html: 'A ⊕ B', bits: '0110', note: 'EX-OR（対称差）' },
    { html: ov('A ⊕ B'), bits: '1001', note: 'EX-NOR（一致）' },
    { html: 'A · ' + ov('B'), bits: '0010', note: '差集合 A − B' },
    { html: ov('A') + ' · B', bits: '0100', note: '差集合 B − A' },
    { html: ov('A') + ' + B', bits: '1101', note: '含意（A ならば B）' },
    { html: 'A', bits: '0011', note: 'A そのもの' },
    { html: ov('A'), bits: '1100', note: 'A の補集合' },
    { html: 'A + ' + ov('B'), bits: '1011', note: '含意（B ならば A）' }
  ];

  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /** 互いに出力の異なる n 個を選ぶ（正解を含む） */
  function distinct(correct, n, pool) {
    const out = [correct];
    for (const c of shuffle(pool)) {
      if (out.length >= n) break;
      if (out.some(o => o.bits === c.bits)) continue;
      out.push(c);
    }
    return shuffle(out);
  }

  function makeQuestion(notation) {
    const kind = pick(['sym2name', 'tt2name', 'venn2expr', 'expr2venn', 'sym2tt']);

    if (kind === 'sym2name' || kind === 'sym2tt') {
      const type = pick(LP.GATE_ORDER);
      const g = LP.GATES[type];
      const bits = LP.reference.bitsOf(type);
      const labels = g.inputs === 2 ? ['A', 'B'] : ['A'];
      const others = shuffle(LP.GATE_ORDER.filter(t => t !== type)).slice(0, 3);
      const opts = shuffle([type].concat(others));
      if (kind === 'sym2name') {
        return {
          q: 'この回路記号（' + notation + '）のゲート名は？',
          body: '<div class="q-sym">' + LP.standaloneSymbol(type, notation, { scale: 1.25 }) + '</div>',
          options: opts.map(t => ({ html: '<b>' + LP.GATES[t].name + '</b><span class="opt-sub">' + LP.GATES[t].jp + '</span>', key: t })),
          answer: type,
          explain: LP.GATES[type].name + '（' + LP.GATES[type].jp + '）。' + LP.GATES[type].formulaHTML.replace(/<br>[\s\S]*/, '') + '　' + LP.GATES[type].work
        };
      }
      return {
        q: 'この回路記号（' + notation + '）の真理値表は？',
        body: '<div class="q-sym">' + LP.standaloneSymbol(type, notation, { scale: 1.25 }) + '</div>',
        options: opts.map(t => ({
          html: LP.tables.miniTable(LP.GATES[t].inputs === 2 ? ['A', 'B'] : ['A'], LP.reference.bitsOf(t)),
          key: t
        })),
        answer: type,
        explain: LP.GATES[type].name + ' の出力は、' + labels.join('') + ' を上から順に並べると ' + bits.split('').join(' → ') + '。' + LP.GATES[type].work
      };
    }

    if (kind === 'tt2name') {
      const type = pick(LP.GATE_ORDER);
      const g = LP.GATES[type];
      const bits = LP.reference.bitsOf(type);
      const labels = g.inputs === 2 ? ['A', 'B'] : ['A'];
      const others = shuffle(LP.GATE_ORDER.filter(t => t !== type && LP.reference.bitsOf(t) !== bits)).slice(0, 3);
      const opts = shuffle([type].concat(others));
      return {
        q: 'この真理値表になるゲートは？',
        body: '<div class="q-tt">' + LP.tables.miniTable(labels, bits) + '</div>',
        options: opts.map(t => ({ html: '<b>' + LP.GATES[t].name + '</b><span class="opt-sub">' + LP.GATES[t].jp + '</span>', key: t })),
        answer: type,
        explain: LP.GATES[type].name + '：' + LP.GATES[type].work
      };
    }

    if (kind === 'venn2expr') {
      const correct = pick(POOL);
      const opts = distinct(correct, 4, POOL);
      return {
        q: '塗られた部分を表す論理式はどれ？',
        body: '<div class="q-venn" data-venn="' + correct.bits + '"></div>',
        options: opts.map(o => ({ html: '<span class="opt-formula">' + o.html + '</span>', key: o.bits })),
        answer: correct.bits,
        explain: '正解は ' + correct.html + '（' + correct.note + '）。真理値表では AB = 00, 01, 10, 11 の順に ' + correct.bits.split('').join(' ') + ' となります。'
      };
    }

    // expr2venn
    const correct = pick(POOL);
    const opts = distinct(correct, 4, POOL);
    return {
      q: '<span class="opt-formula">Y = ' + correct.html + '</span> を表すベン図はどれ？',
      body: '',
      options: opts.map(o => ({ html: '<div class="opt-venn" data-venn="' + o.bits + '"></div>', key: o.bits })),
      answer: correct.bits,
      explain: '正解は ' + correct.note + '。塗られるのは出力が 1 になる領域で、AB = 00, 01, 10, 11 の順に ' + correct.bits.split('').join(' ') + ' です。'
    };
  }

  class Quiz {
    constructor(root, getNotation) {
      this.root = root;
      this.getNotation = getNotation;
      this.renderStart();
    }

    renderStart() {
      this.root.innerHTML =
        '<div class="quiz-start card">' +
        '<h2>論理ゲート クイズ</h2>' +
        '<p class="lead">回路記号・真理値表・ベン図・論理式のあいだを行き来する 4 択問題を ' + N_Q + ' 問出題します。</p>' +
        '<button class="btn primary big" id="quizStart">はじめる</button>' +
        '</div>';
      this.root.querySelector('#quizStart').addEventListener('click', () => this.start());
    }

    start() {
      this.qs = [];
      for (let i = 0; i < N_Q; i++) this.qs.push(makeQuestion(this.getNotation()));
      this.i = 0;
      this.score = 0;
      this.renderQ();
    }

    renderQ() {
      const q = this.qs[this.i];
      let h = '<div class="quiz card">';
      h += '<div class="quiz-bar"><span>第 ' + (this.i + 1) + ' 問 / ' + N_Q + '</span><span>正解 ' + this.score + '</span></div>';
      h += '<div class="quiz-progress"><i style="width:' + (this.i / N_Q * 100) + '%"></i></div>';
      h += '<h3 class="quiz-q">' + q.q + '</h3>';
      h += q.body;
      h += '<div class="quiz-options">';
      q.options.forEach((o, k) => { h += '<button class="opt" data-k="' + k + '">' + o.html + '</button>'; });
      h += '</div><div class="quiz-feedback" id="qfb"></div></div>';
      this.root.innerHTML = h;
      this.root.querySelectorAll('[data-venn]').forEach(el => {
        el.appendChild(LP.venn.make(['A', 'B'], el.getAttribute('data-venn'), { w: 150, h: 100 }));
      });
      this.root.querySelectorAll('.opt').forEach(btn => {
        btn.addEventListener('click', () => this.answer(+btn.getAttribute('data-k')));
      });
    }

    answer(k) {
      const q = this.qs[this.i];
      const chosen = q.options[k];
      const ok = chosen.key === q.answer;
      if (ok) this.score++;
      this.root.querySelectorAll('.opt').forEach((btn, idx) => {
        btn.disabled = true;
        if (q.options[idx].key === q.answer) btn.classList.add('correct');
        else if (idx === k) btn.classList.add('wrong');
      });
      const fb = this.root.querySelector('#qfb');
      fb.className = 'quiz-feedback show ' + (ok ? 'ok' : 'ng');
      fb.innerHTML = '<p class="verdict">' + (ok ? '◯ 正解！' : '✕ ざんねん…') + '</p><p>' + q.explain + '</p>' +
        '<button class="btn primary" id="qnext">' + (this.i === N_Q - 1 ? '結果を見る' : 'つぎの問題 →') + '</button>';
      fb.querySelector('#qnext').addEventListener('click', () => {
        this.i++;
        if (this.i >= N_Q) this.renderResult(); else this.renderQ();
      });
    }

    renderResult() {
      const p = Math.round(this.score / N_Q * 100);
      const msg = p === 100 ? '全問正解！論理回路マスターです。' : p >= 70 ? 'よくできました！早見表でもう一押し。' : '早見表とパズルで復習してみましょう。';
      this.root.innerHTML =
        '<div class="quiz-start card">' +
        '<h2>結果</h2>' +
        '<p class="score">' + this.score + ' / ' + N_Q + '<span>（' + p + '点）</span></p>' +
        '<p class="lead">' + msg + '</p>' +
        '<button class="btn primary big" id="quizStart">もう一度</button>' +
        '</div>';
      this.root.querySelector('#quizStart').addEventListener('click', () => this.start());
    }
  }

  LP.Quiz = Quiz;
})(window);
