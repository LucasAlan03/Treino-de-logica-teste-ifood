const test = require('node:test');
const assert = require('node:assert');
const L = require('./carregar').load();
const LEVELS = [0, 1, 2];
const N = 1500;

// ---------- base ----------
test('rng determinístico e int inclusivo', () => {
  const a = L.makeRng(42), b = L.makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = L.makeRng(1); const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(r.int(1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});
test('shuffle não altera o original', () => {
  const r = L.makeRng(5), arr = [1, 2, 3, 4, 5]; const s = r.shuffle(arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5]); assert.deepEqual([...s].sort(), arr);
});
test('parseAnswer', () => {
  assert.equal(L.parseAnswer(' 040 '), 40);
  assert.equal(L.parseAnswer(''), null);
  assert.equal(L.parseAnswer('abc'), null);
  assert.equal(L.parseAnswer('12.5'), null);
  assert.equal(L.parseAnswer('12,5'), null);
  assert.equal(L.parseAnswer('2.400'), 2400);
  assert.equal(L.parseAnswer('1.234.567'), 1234567);
  assert.equal(L.parseAnswer('2.40'), null);
});

// ---------- todos os tipos e níveis ----------
test('todo gerador aceita os 3 níveis e marca q.level', () => {
  const r = L.makeRng(17);
  for (const t of L.TYPES) for (const lv of LEVELS) {
    const q = L.GEN[t](r, lv);
    assert.equal(q.type, t); assert.equal(q.level, lv);
    assert.ok(q.explanation && q.explanation.length > 10, t);
    assert.ok(!/undefined|NaN/.test(JSON.stringify(q)), `${t}/${lv}: ${q.prompt}`);
  }
});

// ---------- problemas ----------
test('problema: resposta inteira positiva em todos os níveis', () => {
  const r = L.makeRng(7);
  for (const lv of LEVELS) {
    const prompts = new Set();
    for (let i = 0; i < N; i++) {
      const q = L.GEN.problema(r, lv);
      assert.equal(q.kind, 'number'); assert.equal(q.options, null);
      assert.ok(Number.isInteger(q.answer) && q.answer > 0, q.prompt);
      assert.ok(!/NaN|undefined|Infinity/.test(q.prompt + q.explanation), q.prompt);
      prompts.add(q.data.template);
    }
    assert.ok(prompts.size >= 5, `nível ${lv} tem só ${prompts.size} modelos`);
  }
});
test('problema: pai pelo menos 18 anos mais velho', () => {
  const r = L.makeRng(5); let n = 0;
  for (let i = 0; i < 5000; i++) {
    const q = L.GEN.problema(r, 1); const m = q.prompt.match(/tem (\d+) anos e o pai tem (\d+)/);
    if (m) { n++; assert.ok(+m[2] - +m[1] >= 18, q.prompt); }
  }
  assert.ok(n > 100);
});
test('problema difícil: torneiras, encontro e sequência conferidos', () => {
  const r = L.makeRng(31); const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const q = L.GEN.problema(r, 2), d = q.data;
    seen.add(d.template);
    if (d.template === 'torneiras') assert.ok(Math.abs(1 / d.a + 1 / d.b - 1 / q.answer) < 1e-9, q.prompt);
    if (d.template === 'encontro') assert.equal(q.answer * (d.v1 + d.v2), d.D);
    if (d.template === 'sequencia') assert.equal(d.seq.length, 5);
  }
  for (const t of ['torneiras', 'encontro', 'descontos', 'juros', 'sequencia']) assert.ok(seen.has(t), t);
});

// ---------- padrões ----------
test('padrao: um conjunto quebra a regra, sem ambiguidade, todos os níveis', () => {
  const V = ch => 'AEIOU'.includes(ch), nv = s => [...s].filter(V).length;
  const extra = [s => nv(s) > 0, s => nv(s) === 0, s => nv(s) === 1];
  const r = L.makeRng(11);
  for (const lv of LEVELS) {
    const rules = new Set();
    for (let i = 0; i < N; i++) {
      const q = L.GEN.padrao(r, lv);
      assert.equal(q.options.length, 5); assert.equal(new Set(q.options).size, 5);
      q.options.forEach(o => assert.match(o, /^[A-Z]{4}$/));
      const rule = L.PATTERN_RULES.find(x => x.id === q.data.rule);
      assert.equal(rule.lv, lv);
      rules.add(rule.id);
      q.options.forEach((o, k) => assert.equal(rule.test(o), k !== q.answer, `${rule.id}: ${q.options.join(' ')}`));
      for (const f of [...L.PATTERN_RULES.map(x => x.test), ...extra]) {
        const fails = q.options.map((o, k) => f(o) ? -1 : k).filter(k => k >= 0);
        const passes = q.options.map((o, k) => f(o) ? k : -1).filter(k => k >= 0);
        if (fails.length === 1) assert.equal(fails[0], q.answer, q.options.join(' '));
        if (passes.length === 1) assert.equal(passes[0], q.answer, q.options.join(' '));
      }
    }
    assert.ok(rules.size >= 3, `nível ${lv}: ${[...rules]}`);
  }
});

// ---------- silogismos ----------
test('silogismo: answer bate com valid e resultados equilibrados', () => {
  const r = L.makeRng(3);
  for (const lv of LEVELS) {
    const count = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const q = L.GEN.silogismo(r, lv); const [v1, v2] = q.data.valid;
      const exp = v1 && v2 ? 2 : v1 ? 0 : v2 ? 1 : 3;
      assert.equal(q.answer, exp); assert.deepEqual(q.options, L.SYL_OPTIONS);
      q.data.items.forEach((it, k) => { assert.equal(it.premises.length, 2); assert.equal(it.valid, q.data.valid[k]); });
      count[q.answer]++;
    }
    count.forEach(c => assert.ok(c > N / 8, String(count)));
  }
});
test('silogismo: validade de casos clássicos', () => {
  const T = (x, y) => ({ k: 'T', x, y }), S = (x, y) => ({ k: 'S', x, y }), Nn = (x, y) => ({ k: 'N', x, y }), O = (x, y) => ({ k: 'O', x, y });
  assert.equal(L.sylValid([T(0, 1), T(1, 2)], T(0, 2)), true);
  assert.equal(L.sylValid([S(0, 1), T(1, 2)], T(0, 2)), false);
  assert.equal(L.sylValid([T(0, 1), T(1, 2)], T(2, 0)), false);
  assert.equal(L.sylValid([T(0, 1), Nn(1, 2)], Nn(0, 2)), true);
  assert.equal(L.sylValid([S(0, 1), S(1, 2)], S(0, 2)), false);
  assert.equal(L.sylValid([S(0, 1), Nn(1, 2)], O(0, 2)), true);
  assert.equal(L.sylValid([T(0, 1), S(2, 1)], S(2, 0)), false);
});
test('silogismo: avisa quando depende de o grupo existir', () => {
  const r = L.makeRng(8); let n = 0;
  for (let i = 0; i < 3000; i++) for (const it of L.GEN.silogismo(r, 1).data.items) {
    if (it.needsImport) { n++; assert.match(it.reason, /pelo menos um/); }
    else assert.doesNotMatch(it.reason, /pelo menos um/);
  }
  assert.ok(n > 20);
});

// ---------- diagramas ----------
test('diagrama: banco e opções em todos os níveis', () => {
  assert.ok(L.DIAGRAM_TRIOS.length >= 60);
  for (const k of L.DIAGRAM_KEYS) assert.ok(L.DIAGRAM_TRIOS.filter(t => t.d === k).length >= 5, k);
  const bad = ['brasileiros|argentinos|sul-americanos', 'médicos|pais|adultos'];
  for (const t of L.DIAGRAM_TRIOS) assert.ok(!bad.includes(t.g.join('|')), t.g.join());
  const r = L.makeRng(9);
  for (const lv of LEVELS) for (let i = 0; i < N; i++) {
    const q = L.GEN.diagrama(r, lv);
    assert.equal(q.options.length, 5); assert.equal(new Set(q.options).size, 5);
    assert.equal(q.options[q.answer], q.data.correct);
    if (lv === 0) assert.ok('ABCD'.includes(q.data.correct));
    if (lv === 2) assert.ok('EFGH'.includes(q.data.correct));
  }
});

// ---------- matrizes ----------
test('matriz: só a resposta resolve, em todos os níveis e modos', () => {
  const r = L.makeRng(13);
  for (const lv of LEVELS) {
    const modes = new Set();
    for (let i = 0; i < N; i++) {
      const q = L.GEN.matriz(r, lv);
      modes.add(q.data.mode);
      assert.equal(q.data.grid.length, 8); assert.equal(q.options.length, 5);
      for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert.ok(!L.cellEq(q.options[a], q.options[b]), `${q.data.mode} opções iguais`);
      q.options.forEach((c, k) => assert.equal(L.matrixSolves(q, c), k === q.answer, `${q.data.mode} lv${lv} k=${k} ans=${q.answer}`));
    }
    if (lv === 2) for (const m of ['overlay', 'move', 'count', 'fig']) assert.ok(modes.has(m), m);
  }
});
test('matriz média/difícil (fig): distratores só mudam atributos das regras', () => {
  const r = L.makeRng(44);
  for (let i = 0; i < 1000; i++) {
    const q = L.GEN.matriz(r, 1);
    if (q.data.mode !== 'fig') continue;
    const ruled = q.data.rules.map(x => x.attr), ans = q.options[q.answer];
    for (const o of q.options) for (const a of ['shape', 'size', 'count', 'fill'])
      if (!ruled.includes(a)) assert.equal(o[a], ans[a], `${a} mudou sem ser regra`);
  }
});
test('matriz sobreposição: linhas 1-2 distinguem OU de OU-exclusivo', () => {
  const r = L.makeRng(55); let n = 0;
  for (let i = 0; i < 3000; i++) {
    const q = L.GEN.matriz(r, 2);
    if (q.data.mode !== 'overlay') continue; n++;
    const g = q.data.grid.map(c => c.m);
    assert.ok((g[0] & g[1]) !== 0 || (g[3] & g[4]) !== 0, 'sem sobreposição nas linhas de exemplo');
  }
  assert.ok(n > 100);
});

// ---------- adaptativo ----------
test('nextLevel sobe no acerto e desce no erro, entre 0 e 2', () => {
  assert.equal(L.nextLevel(1, true), 2); assert.equal(L.nextLevel(2, true), 2);
  assert.equal(L.nextLevel(1, false), 0); assert.equal(L.nextLevel(0, false), 0);
});
test('buildPlan: teste 20 (4 de cada), treino 10 do tipo', () => {
  const r = L.makeRng(21);
  const p = L.buildPlan('teste', r); assert.equal(p.length, 20);
  for (const t of L.TYPES) assert.equal(p.filter(x => x === t).length, 4);
  const d = L.buildPlan('treino:matriz', r); assert.equal(d.length, 10); assert.ok(d.every(x => x === 'matriz'));
});
test('genQuestion não repete dentro do mesmo teste', () => {
  const r = L.makeRng(2), seen = new Set(), trios = [];
  for (let i = 0; i < 10; i++) trios.push(L.genQuestion('diagrama', 1, r, seen).data.trio);
  assert.equal(new Set(trios).size, 10);
});
test('isCorrect: timeout é erro', () => {
  const q = L.GEN.problema(L.makeRng(1), 1);
  assert.equal(L.isCorrect(q, q.answer), true);
  assert.equal(L.isCorrect(q, q.answer + 1), false);
  assert.equal(L.isCorrect(q, null), false);
});
