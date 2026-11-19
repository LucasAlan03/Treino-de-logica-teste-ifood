# Treino de Raciocínio Lógico — Design

**Data:** 2026-11-14
**Objetivo:** treinar para o teste adaptativo de lógica do processo seletivo do iFood (cerca de 17 questões, 90s cada) e descobrir em que tipo de questão o usuário mais erra.

## Requisitos (confirmados pelo usuário)

- 5 tipos de questão, iguais aos exemplos do teste:
  1. **Silogismos**: duas premissas e duas conclusões. Alternativas fixas: "Apenas a primeira lógica está correta", "Apenas a segunda lógica está correta", "As duas lógicas estão corretas", "Nenhuma lógica está correta". Avalia só a validade lógica, não se a frase faz sentido no mundo real.
  2. **Diagramas**: 3 grupos (ex.: "mesas, móveis, jornais") e 5 desenhos fixos de círculos. O usuário escolhe o desenho que representa a relação entre os grupos.
  3. **Matrizes 3×3**: figuras com um "?" na última célula e 5 alternativas desenhadas.
  4. **Padrões**: 5 conjuntos de 4 letras. O usuário marca o que não segue a regra dos outros 4. A regra nunca é formar palavras.
  5. **Resolução de problemas**: contas de proporção e aritmética. A resposta é um número inteiro digitado.
- 90 segundos por questão. Quando o tempo acaba, a questão conta como erro e passa sozinha para a próxima. Não dá para voltar.
- "Novo teste" com 20 questões misturadas, **diferentes a cada vez** (para não decorar respostas). Os testes feitos ficam numerados no histórico (Teste 1, Teste 2...). Também há um modo "Treino por tipo" com 10 questões.
- Ao final: resultado por tipo e explicação de cada erro.
- Funciona sem internet.

## Arquitetura

- Um arquivo só: `treino-logica.html` na raiz do projeto. HTML, CSS e JS ficam dentro dele, sem dependências externas nem fontes da internet.
- O histórico fica no `localStorage`. Toda leitura e escrita é protegida com try/catch, e o app funciona mesmo sem armazenamento.
- As figuras (matrizes e diagramas) são geradas como SVG inline pelo JS.

### Partes do código (dentro do mesmo arquivo)

| Parte | Responsabilidade |
|---|---|
| `GEN` | Um gerador por tipo: `GEN[type](rng)` → `{type, prompt, options, answer, explanation}`. As figuras usam descritores (ex.: `{shape:'circle', size:2, fill:'none', count:1, rot:0}`) em vez de SVG pronto. |
| `renderShape(desc)` | Transforma um descritor de figura em SVG. |
| `DIAGRAMS` | Os 8 desenhos de círculos (veja abaixo). |
| `buildTest()` / `buildDrill(type)` | Montam a lista de questões chamando os geradores com uma semente aleatória. Assim cada teste sai diferente. Dentro do mesmo teste não se repete o mesmo trio de diagrama nem a mesma regra com as mesmas letras. |
| `Runner` | Mostra a questão, controla o cronômetro de 90s, registra resposta e tempo, e avança. |
| `Results` | Monta a tela de resultado e salva no histórico. |
| `Stats` | Junta o histórico e mostra acertos por tipo, tempo médio, o tipo mais fraco e uma dica. |

### Os diagramas (`DIAGRAMS`)

Um conjunto de 8 desenhos de 3 círculos:
- A: três separados
- B: um dentro do outro (três níveis)
- C: um dentro de outro, mais um separado
- D: um grande com dois separados dentro
- E: dois cruzados, mais um separado
- F: um grande com dois cruzados dentro
- G: três cruzados entre si (todos se sobrepõem, tipo Venn)
- H: um dentro de outro, com um terceiro cruzando o de fora

Cada questão mostra 5 desenhos numerados de 1 a 5, sempre com o certo e quatro distratores. Só um deles representa a relação corretamente. (Ex.: "mesas, móveis, jornais" → C; "bombons, doces, coisas de comer" → B.)

## Telas

1. **Início**: botão Novo teste (20 questões), Treino por tipo (com os 5 tipos para escolher), Meu desempenho e uma explicação curta de cada tipo, com dicas.
2. **Questão**: barra de progresso (ex.: 7/20), nome do tipo, cronômetro (vermelho nos últimos 15s), enunciado e alternativas. Clicar numa alternativa já responde. Na resolução de problemas, a resposta é um campo numérico com botão "Responder" (o Enter também envia).
3. **Resultado**: % de acertos, acertos e tempo médio por tipo em barras, e a lista das questões erradas ou que estouraram o tempo, com sua resposta, a resposta certa e a explicação.
4. **Meu desempenho**: soma de todos os testes, tipo mais fraco em destaque com uma dica, lista dos últimos testes e botão para apagar o histórico.

## Geradores (questões novas a cada teste)

Toda questão vem com uma explicação gerada junto.
- **Matrizes:** sorteiam 1 ou 2 regras (tamanho, quantidade, rotação, preenchimento, forma por linha ou coluna) e as formas. Os distratores mudam um atributo da resposta certa.
- **Padrões:** sorteiam uma regra (sequência consecutiva, salto fixo +2/+3, ordem decrescente, letra dupla no meio, simetria tipo ABBA, vogal na mesma posição) e geram 4 conjuntos que seguem a regra e 1 que quebra só ela.
- **Silogismos:** as formas lógicas são fixas e já classificadas como válidas ou inválidas (Barbara, Celarent, Darii, Ferio, a conversão inválida do "todo", algum→algum, negação do antecedente...). As palavras saem de listas grandes de substantivos. Cada questão combina 2 conclusões, e o resultado (só a 1ª / só a 2ª / as duas / nenhuma) sai equilibrado.
- **Diagramas:** banco de mais de 60 trios de grupos, cada um com o desenho correto (A–H). Em cada questão os 5 desenhos são embaralhados.
- **Problemas:** modelos de proporção, porcentagem, regra de três, idade, velocidade e trabalho. Os números são sorteados de modo que a resposta seja sempre inteira.

## Verificação

Um script Node (`scripts/validar.js`) extrai o código entre os marcadores `/*GEN-START*/ … /*GEN-END*/` do HTML, gera 2000 questões de cada tipo e confere:
- `answer` é um índice válido e as alternativas não se repetem (nas figuras, os descritores são comparados);
- nas matrizes, só a alternativa certa satisfaz a regra;
- nos padrões, a regra vale para os 4 conjuntos corretos e falha no diferente, e nenhuma outra regra do catálogo isola um conjunto diferente;
- nas questões numéricas, a resposta é inteira e positiva;
- nos silogismos, as 4 respostas aparecem com frequência razoável;
- `buildTest()` devolve 20 questões com os 5 tipos.

## Fora do escopo

Contas de usuário, sincronizar entre aparelhos, criar questões novas automaticamente e modo adaptativo.

---

# v2 — Níveis, adaptativo e pausa (2026-11-15)

**Por quê:** o usuário achou as matrizes "só de repetir" e os problemas concentrados em proporção. O endereço da prova real é "teste-adaptativo", ou seja, a dificuldade sobe conforme o candidato acerta.

**Aprovado pelo usuário:**
- 3 níveis (fácil, médio e difícil) em todos os tipos, inclusive nas sequências de letras.
- Os silogismos quase não mudam.
- Pausar e continuar um teste, voltando com o tempo que faltava.

**Decisões minhas (o usuário saiu e pediu para seguir):**
- **Adaptativo por tipo:** cada tipo começa no médio, sobe 1 nível quando o usuário acerta e desce 1 quando erra. O nível aparece discretamente no cabeçalho da questão e no resultado. As questões são geradas na hora em que aparecem.
- **Matrizes:**
  - Fácil: 1 regra por linha ou coluna.
  - Médio: 2 regras, e os distratores só mudam os atributos das regras (são pegadinhas sutis).
  - Difícil: sobreposição (OU / OU exclusivo de traços), ponto e marcador que se movem pela borda, contagem com soma ou subtração, ou 3 regras ao mesmo tempo.
- **Padrões:**
  - Fácil: consecutiva, decrescente e letra dupla.
  - Médio: saltos de 2 ou 3, espelho e vogal.
  - Difícil: saltos crescentes (1,2,3) ou decrescentes, alternado (+2, −1), letras opostas no alfabeto (A↔Z) e salto de −2.
- **Problemas:**
  - Fácil: regra de três, porcentagem, proporção, velocidade e caixas.
  - Médio: inversa, idades, frações, produção, média e sequência numérica.
  - Difícil: torneiras/trabalho conjunto, encontro de veículos, descontos sucessivos, juros simples, lucro, idade em duas etapas e sequência numérica difícil.
- **Diagramas:** o fácil usa só relações de "dentro" e "separado" (A–D); o médio usa todas; o difícil usa as relações com cruzamento (E–H).
- **Silogismos:** o fácil usa só "todo/nenhum"; o difícil usa mais "alguns/alguns não".
- **Pausa:**
  - O estado fica salvo em `treinoLogica.run.v1` toda vez que uma questão abre, a cada 2 s e ao sair da página.
  - O botão "Pausar" volta para o início, que mostra "Continuar teste".
  - Começar um teste novo descarta o pausado, depois de confirmar.
