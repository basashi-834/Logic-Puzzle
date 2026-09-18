/* =========================================================================
 * puzzles.js - ステージ定義
 *   target のビット列は真理値表の行順（先頭の入力名が最上位ビット）。
 *   例: 入力 A,B のとき "0001" は AB=00,01,10,11 の順に 0,0,0,1。
 * ========================================================================= */
(function (global) {
  'use strict';
  const ov = global.LP.ov;

  const STAGES = [
    {
      id: 's01', chapter: '第1章 きほんのゲート', title: 'AND ― 両方そろって 1',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND'], target: { Y: '0001' }, minGates: 1,
      desc: 'A と B が<b>両方 1 のときだけ</b>出力 Y が 1 になる回路を作りましょう。',
      hint: 'パレットの AND を盤面へドラッグ。つぎに A の右の端子から AND の左上の端子へドラッグして線をつなぎます。同じように B と Y もつなぎましょう。',
      lesson: 'AND は「かつ（∩）」。ベン図では A と B の重なった部分だけが塗られます。'
    },
    {
      id: 's02', chapter: '第1章 きほんのゲート', title: 'OR ― どちらかが 1',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['OR'], target: { Y: '0111' }, minGates: 1,
      desc: 'A と B の<b>どちらかが 1</b> なら Y が 1 になる回路を作りましょう。',
      hint: 'OR を 1 個置いて、A・B・Y をつなぐだけです。',
      lesson: 'OR は「または（∪）」。ベン図では 2 つの円を合わせた部分が塗られます。'
    },
    {
      id: 's03', chapter: '第1章 きほんのゲート', title: 'NOT ― ひっくり返す',
      inputs: ['A'], outputs: ['Y'], gates: ['NOT'], target: { Y: '10' }, minGates: 1,
      desc: '入力 A を<b>反転</b>して出力する回路を作りましょう。A=0 なら Y=1、A=1 なら Y=0 です。',
      hint: 'NOT の入力は 1 本だけ。A → NOT → Y の順につなぎます。',
      lesson: 'NOT は「補集合」。ベン図では円の外側が塗られます。論理式では ' + ov('A') + ' と上線で書きます。'
    },
    {
      id: 's04', chapter: '第2章 組み合わせる', title: 'NAND を組み立てる',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND', 'NOT'], target: { Y: '1110' }, minGates: 2,
      desc: 'AND と NOT だけで <b>NAND</b>（否定論理積）と同じはたらきの回路を作りましょう。',
      hint: 'AND の出力を NOT に通してから Y へ。',
      lesson: 'NAND = AND のうしろに NOT。記号では出力側の小さな丸（バブル）が NOT を表しています。'
    },
    {
      id: 's05', chapter: '第2章 組み合わせる', title: 'NOR を組み立てる',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['OR', 'NOT'], target: { Y: '1000' }, minGates: 2,
      desc: 'OR と NOT だけで <b>NOR</b>（否定論理和）と同じはたらきの回路を作りましょう。',
      hint: 'OR の出力を NOT に通します。1 になるのは A も B も 0 のときだけ。',
      lesson: 'NOR は「どちらでもない」。ベン図では 2 つの円の外側だけが塗られます。'
    },
    {
      id: 's06', chapter: '第3章 ド・モルガンの法則', title: 'ド・モルガン① ' + ov('A · B') + ' = ' + ov('A') + ' + ' + ov('B'),
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['OR', 'NOT'], target: { Y: '1110' }, minGates: 3,
      desc: 'AND を使わずに、<b>OR と NOT だけ</b>で NAND と同じ真理値表を作ってください。',
      hint: 'A と B をそれぞれ NOT で反転してから OR に入れます。',
      lesson: 'ド・モルガンの法則：積の否定は、否定の和に等しい。AND と OR は NOT をはさんで入れ替えられます。'
    },
    {
      id: 's07', chapter: '第3章 ド・モルガンの法則', title: 'ド・モルガン② ' + ov('A + B') + ' = ' + ov('A') + ' · ' + ov('B'),
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND', 'NOT'], target: { Y: '1000' }, minGates: 3,
      desc: 'OR を使わずに、<b>AND と NOT だけ</b>で NOR と同じ真理値表を作ってください。',
      hint: 'A と B をそれぞれ反転してから AND に入れます。',
      lesson: '和の否定は、否定の積。①と②を合わせて「ド・モルガンの法則」と呼びます。'
    },
    {
      id: 's08', chapter: '第4章 EX-OR に挑戦', title: 'EX-OR を作る',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND', 'OR', 'NOT'], target: { Y: '0110' }, minGates: 5,
      desc: 'AND・OR・NOT だけで <b>EX-OR</b>（入力が違うときだけ 1）を作りましょう。',
      hint: 'Y = ' + ov('A') + '·B + A·' + ov('B') + '。NOT 2 個・AND 2 個・OR 1 個で作れます。',
      lesson: 'EX-OR は「ちがいを見つける」回路。1 ビットの足し算の答え（和の桁）でもあります。'
    },
    {
      id: 's09', chapter: '第4章 EX-OR に挑戦', title: 'EX-NOR（一致回路）を作る',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND', 'OR', 'NOT'], target: { Y: '1001' }, minGates: 5,
      desc: '入力が<b>同じとき</b>だけ 1 になる回路を、AND・OR・NOT で作りましょう。',
      hint: 'Y = ' + ov('A') + '·' + ov('B') + ' + A·B。両方 0 のときと両方 1 のときを OR でまとめます。',
      lesson: 'EX-NOR は 2 つの値が等しいかを調べる「一致回路（コンパレータ）」です。'
    },
    {
      id: 's10', chapter: '第5章 ベン図パズル', title: 'ベン図：A だけを塗る', venn: true,
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['AND', 'NOT'], target: { Y: '0010' }, minGates: 2,
      desc: '右のベン図と<b>同じ塗り方</b>になる回路を作ってください。A に入っていて B に入っていない部分です。',
      hint: 'Y = A · ' + ov('B') + '。B を NOT で反転して A と AND します。',
      lesson: '集合の「差集合 A − B」。ベン図の塗り分けはそのまま論理式に翻訳できます。'
    },
    {
      id: 's11', chapter: '第5章 ベン図パズル', title: 'ベン図：A の外側 ＋ B', venn: true,
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['OR', 'NOT'], target: { Y: '1101' }, minGates: 2,
      desc: '右のベン図と同じになる回路を作ってください。「A ならば B」を表す論理式です。',
      hint: 'Y = ' + ov('A') + ' + B。A を反転して B と OR します。',
      lesson: '含意（ならば）は ' + ov('A') + ' + B と書けます。A が 1 なのに B が 0 のときだけ 0 になります。'
    },
    {
      id: 's12', chapter: '第6章 NAND は万能', title: 'NAND だけで NOT',
      inputs: ['A'], outputs: ['Y'], gates: ['NAND'], target: { Y: '10' }, minGates: 1,
      desc: '<b>NAND を 1 個だけ</b>使って NOT と同じはたらきにしてください。',
      hint: 'NAND の 2 つの入力に、どちらも A をつなぎます（1 つの出力から 2 本に分けられます）。',
      lesson: 'A NAND A = ' + ov('A · A') + ' = ' + ov('A') + '。同じ入力を 2 本に分ける「分岐」がポイントです。'
    },
    {
      id: 's13', chapter: '第6章 NAND は万能', title: 'NAND だけで AND',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['NAND'], target: { Y: '0001' }, minGates: 2,
      desc: 'NAND だけで AND を作ってください。',
      hint: 'NAND の出力を、もう 1 個の NAND で NOT すれば AND に戻ります。',
      lesson: 'NAND → NAND(NOT として使用) = AND。'
    },
    {
      id: 's14', chapter: '第6章 NAND は万能', title: 'NAND だけで OR',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['NAND'], target: { Y: '0111' }, minGates: 3,
      desc: 'NAND だけで OR を作ってください。',
      hint: 'A と B をそれぞれ NAND で反転し、その 2 つを NAND に入れます（ド・モルガンの法則）。',
      lesson: ov('A') + ' NAND ' + ov('B') + ' = A + B。ド・モルガンの法則が効いています。'
    },
    {
      id: 's15', chapter: '第6章 NAND は万能', title: 'NAND 4 個で EX-OR',
      inputs: ['A', 'B'], outputs: ['Y'], gates: ['NAND'], target: { Y: '0110' }, minGates: 4,
      desc: 'NAND を 4 個だけ使って EX-OR を作ってください。かなりの難問です。',
      hint: 'まず N1 = A NAND B。つぎに N2 = A NAND N1、N3 = B NAND N1。最後に N4 = N2 NAND N3。',
      lesson: 'NAND だけであらゆる論理回路が作れます（機能的完全性）。実際の IC でも NAND が基本部品です。'
    },
    {
      id: 's16', chapter: '第7章 実用回路', title: '多数決回路（3 入力）',
      inputs: ['A', 'B', 'C'], outputs: ['Y'], gates: ['AND', 'OR'], target: { Y: '00010111' }, minGates: 5,
      desc: '3 つの入力のうち<b>2 つ以上が 1</b> なら 1 になる回路を作ってください。',
      hint: 'Y = A·B + B·C + A·C。AND 3 個を OR 2 個でまとめます。',
      lesson: '多数決回路は、故障に強い装置（冗長系）や投票の判定に使われます。'
    },
    {
      id: 's17', chapter: '第7章 実用回路', title: '半加算器（1 ビットの足し算）',
      inputs: ['A', 'B'], outputs: ['S', 'C'], gates: ['XOR', 'AND', 'OR', 'NOT'],
      target: { S: '0110', C: '0001' }, minGates: 2,
      desc: '1 ビットの足し算です。S は<b>和</b>、C は<b>桁上がり</b>。1 + 1 = 10（2 進数）になるようにします。',
      hint: 'S = A ⊕ B、C = A · B。出力が 2 つあるので、A と B の線を分岐させます。',
      lesson: 'これが「半加算器（Half Adder）」。コンピュータの足し算はここから始まります。'
    },
    {
      id: 's18', chapter: '第7章 実用回路', title: '全加算器（桁上がり入力つき）',
      inputs: ['A', 'B', 'Ci'], outputs: ['S', 'Co'], gates: ['XOR', 'AND', 'OR'],
      target: { S: '01101001', Co: '00010111' }, minGates: 5,
      desc: '下の桁からの桁上がり Ci も足します。S は和、Co は次の桁への桁上がりです。',
      hint: 'S = A ⊕ B ⊕ Ci、Co = A·B + (A ⊕ B)·Ci。半加算器を 2 つつなげた形です。',
      lesson: '全加算器を桁の数だけ並べると、何ビットでも足せる加算器になります。CPU の心臓部です。'
    }
  ];

  global.LP.STAGES = STAGES;
})(window);
