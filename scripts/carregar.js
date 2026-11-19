// Extrai o trecho entre /*GEN-START*/ e /*GEN-END*/ do HTML e o executa no Node.
const fs = require('fs');
const path = require('path');

const NAMES = [
  'makeRng', 'TYPES', 'TYPE_LABEL', 'GEN', 'parseAnswer', 'PATTERN_RULES',
  'SYL_OPTIONS', 'DIAGRAM_KEYS', 'DIAGRAM_TRIOS', 'cellEq', 'cellSolves',
  'buildPlan', 'genQuestion', 'nextLevel', 'matrixSolves', 'isCorrect', 'sylValid',
];

function load() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'treino-logica.html'), 'utf8');
  const m = html.match(/\/\*GEN-START\*\/([\s\S]*?)\/\*GEN-END\*\//);
  if (!m) throw new Error('marcadores GEN não encontrados');
  const ret = NAMES.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(',');
  return new Function(`${m[1]}\n;return {${ret}};`)();
}

module.exports = { load };
