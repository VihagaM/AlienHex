/**
 * Safe math evaluator (recursive-descent parser). It NEVER uses eval()/Function(),
 * so user input cannot execute code.
 *
 * Supports: + - * / % ^ (and **), parentheses, unary minus, decimals,
 * constants (pi, e) and one-argument functions (sqrt, abs, sin, cos, tan, log, ln, round, floor, ceil).
 */
const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

function tokenize(input) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([a-z]+)|(\*\*|[+\-*/%^()]))/giy;
  let lastIndex = 0;
  let match;
  while (lastIndex < input.length && (match = re.exec(input))) {
    lastIndex = re.lastIndex;
    if (match[1] !== undefined) tokens.push({ type: 'num', value: parseFloat(match[1]) });
    else if (match[2] !== undefined) tokens.push({ type: 'id', value: match[2].toLowerCase() });
    else tokens.push({ type: 'op', value: match[3] === '**' ? '^' : match[3] });
  }
  if (input.slice(lastIndex).trim() !== '') throw new Error('Invalid character in expression');
  return tokens;
}

export function evaluateExpression(input) {
  const source = String(input).replace(/×/g, '*').replace(/÷/g, '/');
  if (!source.trim()) throw new Error('Empty expression');
  if (source.length > 200) throw new Error('Expression too long');

  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (t, v) => t && t.type === 'op' && t.value === v;

  function parseExpression() {
    let left = parseTerm();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = next().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (isOp(peek(), '*') || isOp(peek(), '/') || isOp(peek(), '%')) {
      const op = next().value;
      const right = parseUnary();
      if (op === '*') left *= right;
      else if (op === '/') left /= right;
      else left %= right;
    }
    return left;
  }

  function parseUnary() {
    if (isOp(peek(), '-')) {
      next();
      return -parseUnary();
    }
    if (isOp(peek(), '+')) {
      next();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (isOp(peek(), '^')) {
      next();
      return base ** parseUnary(); // right-associative
    }
    return base;
  }

  function parsePrimary() {
    const token = next();
    if (!token) throw new Error('Unexpected end of expression');
    if (token.type === 'num') return token.value;
    if (token.type === 'id') {
      if (token.value in CONSTANTS) return CONSTANTS[token.value];
      if (token.value in FUNCTIONS) {
        if (!isOp(next(), '(')) throw new Error(`Expected "(" after ${token.value}`);
        const arg = parseExpression();
        if (!isOp(next(), ')')) throw new Error('Missing closing parenthesis');
        return FUNCTIONS[token.value](arg);
      }
      throw new Error(`Unknown name "${token.value}"`);
    }
    if (isOp(token, '(')) {
      const value = parseExpression();
      if (!isOp(next(), ')')) throw new Error('Missing closing parenthesis');
      return value;
    }
    throw new Error(`Unexpected "${token.value}"`);
  }

  const result = parseExpression();
  if (pos < tokens.length) throw new Error('Unexpected token at end of expression');
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number (division by zero?)');
  return Number(result.toPrecision(12));
}
