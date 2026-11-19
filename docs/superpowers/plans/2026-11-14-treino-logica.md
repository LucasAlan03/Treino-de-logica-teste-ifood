# Treino de Raciocínio Lógico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um único `treino-logica.html` offline que gera testes de lógica novos a cada vez (5 tipos, 90s por questão) e mostra em que tipo o usuário mais erra.

**Architecture:** Toda a lógica pura (RNG, geradores, montagem de testes) fica entre `/*GEN-START*/` e `/*GEN-END*/` no HTML e não usa DOM. Assim o Node consegue extrair e testar. A UI (telas, cronômetro, localStorage) fica fora desses marcadores e é verificada no navegador.

**Tech Stack:** HTML/CSS/JS puro (ES2020) e SVG inline. Testes com `node:test` e `node:assert` (Node 26). Sem dependências.

**Spec:** `docs/superpowers/specs/2026-11-14-treino-logica-design.md`

## Global Constraints

- Arquivo único `treino-logica.html` na raiz, sem nenhuma requisição de rede (nada de CDN nem fontes externas).
- Toda a interface em português do Brasil.
- 90 segundos por questão. O tempo esgotado conta como erro e avança sozinho. Não dá para voltar.
- Novo teste = 20 questões com os 5 tipos. Treino por tipo = 10 questões.
- Respostas numéricas sempre inteiras e positivas.
- Todo acesso ao `localStorage` fica dentro de try/catch. O app funciona sem ele.
- A pasta não é repositório git: os passos de "commit" estão omitidos.

## Review Focus

1. **Duplo clique ou Enter repetido** registra só uma resposta e avança só uma questão (o teste do Runner está na Task 7).
2. **Aba em segundo plano:** o cronômetro usa `Date.now()`, não conta ticks, então ao voltar à aba o tempo restante está correto (Task 7).
3. **Resposta numérica com espaços ou zeros à esquerda** (" 040 ") vale como 40. Vazio ou não numérico não é aceito (`parseAnswer`, Task 2).
4. **Padrões ambíguos:** nenhuma outra regra do catálogo isola um conjunto diferente do gabarito (Task 3).
5. **`localStorage` lança exceção** (modo privado): o teste roda, o resultado aparece e o histórico fica vazio sem erro (Task 7).

---

## Formato comum da questão

```js
// Q = {
//   type: 'silogismo'|'diagrama'|'matriz'|'padrao'|'problema',
//   kind: 'choice'|'number',
//   prompt: string,
//   options: any[] | null,     // null quando kind==='number'
//   answer: number,            // índice em options, ou o valor quando number
//   explanation: string,
//   data?: object              // extras por tipo (premissas, grid da matriz...)
// }
// TYPES = ['silogismo','diagrama','matriz','padrao','problema']
// TYPE_LABEL = {silogismo:'Silogismos', diagrama:'Diagramas', matriz:'Matrizes', padrao:'Padrões', problema:'Resolução de problemas'}
```

---

### Task 1: Esqueleto, RNG e harness de testes

**Files:**
- Create: `treino-logica.html`
- Create: `scripts/carregar.js`
- Test: `scripts/validar.test.js`

**Interfaces:**
- Produces: `makeRng(seed:number) → {next():float[0,1), int(a,b):int inclusivo, pick(arr), shuffle(arr):novo array}`. `TYPES`, `TYPE_LABEL`, `GEN = {}`.
- Produces: `scripts/carregar.js` exporta `load() → objeto com tudo que está entre os marcadores` (lê o HTML, extrai o trecho e roda em `new Function(trecho + '; return {makeRng, TYPES, TYPE_LABEL, GEN, ...};')`; a lista de nomes retornados cresce com as tasks).

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test'); const assert = require('node:assert');
const L = require('./carregar').load();
test('rng determinístico e int inclusivo', () => {
  const a = L.makeRng(42), b = L.makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = L.makeRng(1); const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(r.int(1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});
test('shuffle não altera o original', () => {
  const r = L.makeRng(5), arr = [1,2,3,4,5]; const s = r.shuffle(arr);
  assert.deepEqual(arr, [1,2,3,4,5]); assert.deepEqual([...s].sort(), arr);
});
```

- [ ] **Step 2:** `node --test scripts/` → FAIL (o arquivo não existe).
- [ ] **Step 3:** Criar o HTML com `<style>`, `<div id="app">` e `<script>` contendo `/*GEN-START*/ … /*GEN-END*/` com `makeRng` (mulberry32), `TYPES`, `TYPE_LABEL` e `const GEN = {}`. Criar `carregar.js`.
- [ ] **Step 4:** `node --test scripts/` → PASS.

---

### Task 2: Gerador de problemas

**Files:** Modify `treino-logica.html` (dentro dos marcadores). Test: `scripts/validar.test.js`.

**Interfaces:**
- Produces: `GEN.problema(rng) → Q` com `kind:'number'`. `parseAnswer(str) → number|null` (trim e inteiro; `null` se vazio ou não numérico).

Modelos (escolher um por questão): proporção com 2 itens (como o exemplo do clipe e do papel), porcentagem, regra de três direta, regra de três inversa (trabalhadores × dias), idade (diferença ou soma), velocidade × tempo e divisão com sobra. Os números são escolhidos de trás para frente a partir de uma resposta inteira.

- [ ] **Step 1: Write the failing test**

```js
test('problema: 2000 gerados, resposta inteira positiva e explicação', () => {
  const r = L.makeRng(7);
  for (let i = 0; i < 2000; i++) {
    const q = L.GEN.problema(r);
    assert.equal(q.kind, 'number'); assert.equal(q.options, null);
    assert.ok(Number.isInteger(q.answer) && q.answer > 0, q.prompt);
    assert.ok(q.explanation.length > 10);
  }
});
test('parseAnswer', () => {
  assert.equal(L.parseAnswer(' 040 '), 40);
  assert.equal(L.parseAnswer(''), null);
  assert.equal(L.parseAnswer('abc'), null);
  assert.equal(L.parseAnswer('12.5'), null);
});
```

- [ ] **Step 2:** Rodar e confirmar que FALHA. **Step 3:** Implementar. **Step 4:** Rodar e confirmar que PASSA.

---

### Task 3: Gerador de padrões

**Interfaces:**
- Produces: `GEN.padrao(rng) → Q` com `options: string[5]` (4 letras maiúsculas, A–Z) e `data.rule: string`. `PATTERN_RULES: {id, label, test(str)→bool, make(rng)→str}[]`.

Regras: `consecutiva` (ABCD), `salto2` (ACEG), `salto3` (ADGJ), `decrescente` (DCBA), `duplaMeio` (GHHP: a 2ª letra é igual à 3ª, e as outras diferentes), `espelho` (ABBA), `vogalInicio` (a 1ª é vogal e as outras são consoantes). O conjunto diferente é feito por `make` e alterado até `!rule.test`.

- [ ] **Step 1: Write the failing test**

```js
test('padrao: exatamente um conjunto quebra a regra, sem ambiguidade', () => {
  const r = L.makeRng(11);
  for (let i = 0; i < 2000; i++) {
    const q = L.GEN.padrao(r);
    assert.equal(q.options.length, 5); assert.equal(new Set(q.options).size, 5);
    q.options.forEach(o => assert.match(o, /^[A-Z]{4}$/));
    const rule = L.PATTERN_RULES.find(x => x.id === q.data.rule);
    q.options.forEach((o, k) => assert.equal(rule.test(o), k !== q.answer, q.options.join(' ')));
    for (const other of L.PATTERN_RULES) {  // nenhuma outra regra isola outro índice
      const fails = q.options.map((o, k) => other.test(o) ? -1 : k).filter(k => k >= 0);
      if (fails.length === 1) assert.equal(fails[0], q.answer, `${other.id}: ${q.options}`);
    }
  }
});
```

- [ ] Steps 2–4: falha → implementar → passa.

---

### Task 4: Gerador de silogismos

**Interfaces:**
- Produces: `GEN.silogismo(rng) → Q` com `options = SYL_OPTIONS`, `data: {premises:[s,s], conclusions:[s,s], valid:[bool,bool]}`.
- `SYL_OPTIONS = ['Apenas a primeira lógica está correta','Apenas a segunda lógica está correta','As duas lógicas estão corretas','Nenhuma lógica está correta']`.

Para cada questão: 3 termos A, B, C de uma lista com mais de 80 substantivos no plural; 2 premissas de uma forma; 2 conclusões tiradas da lista de conclusões classificadas daquela forma (cada uma marcada válida ou inválida). Formas e conclusões (A→B = "Todos os A são B"):
- `Todo A é B; Todo B é C` → válidas: Todo A é C; Algum C é A. Inválidas: Todo C é A; Nenhum A é C.
- `Todo A é B; Nenhum B é C` → válidas: Nenhum A é C; Nenhum C é A. Inválidas: Algum A é C; Todo C é B.
- `Algum A é B; Todo B é C` → válidas: Algum A é C; Algum C é A. Inválidas: Todo A é C; Nenhum A é C.
- `Algum A é B; Nenhum B é C` → válida: Algum A não é C. Inválidas: Nenhum A é C; Algum C não é A.
- `Algum A é B; Algum B é C` → válidas: nenhuma. Inválidas: Algum A é C; Nenhum A é C.
- `Todo A é B; Algum C é B` → inválidas: Algum C é A; Todo C é A.
- `Nenhum A é B; Todo C é B` → válidas: Nenhum C é A; Nenhum A é C. Inválida: Algum C é A.

A resposta é escolhida primeiro (os 4 resultados igualmente prováveis), e só depois as conclusões que a satisfazem. Se uma forma não permite aquela resposta (por exemplo, "as duas" sem 2 conclusões válidas), sorteia outra forma. A explicação cita a regra (ex.: "'Todo A é B' não garante que todo B seja A").

- [ ] **Step 1: Write the failing test**

```js
test('silogismo: answer bate com valid e resultados equilibrados', () => {
  const r = L.makeRng(3); const count = [0,0,0,0];
  for (let i = 0; i < 2000; i++) {
    const q = L.GEN.silogismo(r); const [v1, v2] = q.data.valid;
    const exp = v1 && v2 ? 2 : v1 ? 0 : v2 ? 1 : 3;
    assert.equal(q.answer, exp); assert.deepEqual(q.options, L.SYL_OPTIONS);
    assert.notEqual(q.data.conclusions[0], q.data.conclusions[1]);
    count[q.answer]++;
  }
  count.forEach(c => assert.ok(c > 300, String(count)));
});
```

- [ ] Steps 2–4: falha → implementar → passa.

---

### Task 5: Diagramas

**Interfaces:**
- Produces: `DIAGRAM_KEYS = ['A'..'H']` (veja a spec), `DIAGRAM_TRIOS: {g:[s,s,s], d:key}[]` (≥60), `GEN.diagrama(rng) → Q` com `options: key[5]` (contém `d` e é embaralhado). `diagramSvg(key) → string` (fica fora dos marcadores, na parte de UI, usada na Task 7).

Os trios cobrem todas as 8 chaves (≥5 cada), e os nomes são de conhecimento comum (ex.: `{g:['mesas','móveis','jornais'], d:'C'}`, `{g:['bombons','doces','coisas de comer'], d:'B'}`, `{g:['médicos','mulheres','brasileiros'], d:'G'}`...). A explicação descreve a relação.

Como os desenhos ficam sem rótulo, desenhos que são o mesmo a menos de rótulos não podem aparecer juntos. As 8 chaves já são formas distintas.

- [ ] **Step 1: Write the failing test**

```js
test('diagrama: banco e opções', () => {
  assert.ok(L.DIAGRAM_TRIOS.length >= 60);
  for (const k of L.DIAGRAM_KEYS) assert.ok(L.DIAGRAM_TRIOS.filter(t => t.d === k).length >= 5, k);
  const r = L.makeRng(9);
  for (let i = 0; i < 2000; i++) {
    const q = L.GEN.diagrama(r);
    assert.equal(q.options.length, 5); assert.equal(new Set(q.options).size, 5);
    assert.ok(L.DIAGRAM_KEYS.includes(q.options[q.answer]));
    assert.equal(q.options[q.answer], q.data.correct);
  }
});
```

- [ ] Steps 2–4: falha → implementar → passa.

---

### Task 6: Matrizes

**Interfaces:**
- Produces: `GEN.matriz(rng) → Q` com `data.grid: Cell[8]` (linhas de cima para baixo; a 9ª célula é o "?"), `options: Cell[5]`, `data.rules: string[]`. `Cell = {shape:'circle'|'square'|'triangle'|'star', size:1|2|3, count:1|2|3, fill:'none'|'half'|'solid', rot:0|45|90|135}`. `cellEq(a,b)` e `cellSolves(grid, cell, rules) → bool`.
- `cellSvg(cell) → string` fica na UI (Task 7).

Regras: cada atributo (size, count, fill, rot, shape) ou segue uma progressão ao longo da linha (`'linha:<attr>'`, valores em sequência nas colunas, como no exemplo em que o tamanho diminui), ou é constante na linha e muda entre linhas (`'coluna:<attr>'`), ou é constante no grid inteiro. Sortear 1 ou 2 regras, sempre em atributos diferentes. Os distratores são a resposta com um atributo alterado (primeiro os atributos das regras, que são as pegadinhas plausíveis), todos diferentes entre si.

- [ ] **Step 1: Write the failing test**

```js
test('matriz: só a resposta resolve', () => {
  const r = L.makeRng(13);
  for (let i = 0; i < 2000; i++) {
    const q = L.GEN.matriz(r);
    assert.equal(q.data.grid.length, 8); assert.equal(q.options.length, 5);
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert.ok(!L.cellEq(q.options[a], q.options[b]));
    q.options.forEach((c, k) => assert.equal(L.cellSolves(q.data.grid, c, q.data.rules), k === q.answer));
  }
});
```

- [ ] Steps 2–4: falha → implementar → passa.

---

### Task 7: Montagem de testes e UI completa

**Interfaces:**
- Produces (dentro dos marcadores): `buildTest(rng) → Q[20]` (≥3 de cada tipo, 20 no total, ordem embaralhada, sem trio de diagrama repetido nem conjunto de padrão repetido) e `buildDrill(type, rng) → Q[10]`. `isCorrect(q, resp) → bool` (`resp` é um índice, um número ou `null` quando o tempo acabou).
- Produces (fora dos marcadores): telas `Inicio`, `Questao`, `Resultado`, `Desempenho`. `Store.load()` e `Store.save(hist)` com try/catch, chave `treinoLogica.v1`. Registro: `{n, date, mode:'teste'|'treino:<type>', items:[{type, correct:bool, ms, timeout:bool}]}`.

- [ ] **Step 1: Write the failing test**

```js
test('buildTest e buildDrill', () => {
  const r = L.makeRng(21);
  for (let i = 0; i < 200; i++) {
    const t = L.buildTest(r); assert.equal(t.length, 20);
    for (const ty of L.TYPES) assert.ok(t.filter(q => q.type === ty).length >= 3);
  }
  const d = L.buildDrill('matriz', r);
  assert.equal(d.length, 10); assert.ok(d.every(q => q.type === 'matriz'));
});
test('isCorrect: timeout é erro', () => {
  const q = L.GEN.problema(L.makeRng(1));
  assert.equal(L.isCorrect(q, q.answer), true);
  assert.equal(L.isCorrect(q, null), false);
});
```

- [ ] **Step 2:** Rodar e confirmar que FALHA. **Step 3:** Implementar `buildTest`, `buildDrill` e `isCorrect`. **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5: Implementar a UI** conforme as telas da spec:
  - Cronômetro: `deadline = Date.now() + 90000` e `setInterval(250)` que mostra `Math.ceil((deadline - Date.now())/1000)`, vermelho quando ≤15. Ao chegar a 0, registra timeout e avança.
  - A flag `answered` bloqueia uma segunda resposta.
  - Na questão numérica, o input recebe foco automático e o Enter responde.
  - No Resultado, barras por tipo (CSS) e lista dos erros com a resposta dada, a certa e a explicação. Matrizes e diagramas aparecem com os SVGs.
  - O Desempenho mostra o tipo com menor % de acertos (mínimo de 3 questões respondidas) em destaque, com a dica daquele tipo.
  - `diagramSvg` e `cellSvg` usam `currentColor` para funcionar nos temas claro e escuro. Tema com `prefers-color-scheme`.
- [ ] **Step 6: Verificação no navegador:** abrir `treino-logica.html` e conferir:
  - um teste completo, com uma questão deixada estourar o tempo;
  - duplo clique numa alternativa: o contador avança só 1;
  - trocar de aba por 20s e voltar: o tempo restante caiu cerca de 20s;
  - resultado e desempenho aparecem;
  - no console, `localStorage.setItem = () => { throw 1 }`, refazer um teste: não pode dar erro;
  - largura de celular (DevTools, 375px) sem rolagem horizontal.
- [ ] **Step 7:** `node --test scripts/` → tudo PASSA.
