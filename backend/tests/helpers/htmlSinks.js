const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

// Where the desktop UI writes HTML (innerHTML, outerHTML, insertAdjacentHTML),
// and which values inside that HTML are not passed through an escaper (SEC-05).
//
// A value counts as escaped when it is the result of one of the escapers
// (CF.esc and the pages' own esc/escHtml/escapeHtml/tq/safe, and the short
// e/h aliases bound to them), a string or number literal, arithmetic, or a
// number formatter. Anything else is reported with its source text, so a
// review can say why it is safe (an icon constant, SVG geometry, a count).

const ESCAPERS = new Set(['esc', 'escHtml', 'escapeHtml', 'tq', 'safe', 'e', 'h']);
const ESCAPING_MEMBERS = new Set(['esc', 'engineNoteHTML']); // CF.esc, and CF.engineNoteHTML, which escapes inside
const NUMERIC = new Set(['toFixed', 'round', 'floor', 'ceil', 'min', 'max', 'abs']);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : sourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const nameOf = node => (node.type === 'Identifier' ? node.name
  : node.type === 'MemberExpression' && !node.computed ? node.property.name : null);

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

function leaves(node, out) {
  switch (node.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NullLiteral':
    case 'UnaryExpression': case 'UpdateExpression':
      return;
    case 'TemplateLiteral': node.expressions.forEach(e => leaves(e, out)); return;
    case 'BinaryExpression': if (node.operator === '+') { leaves(node.left, out); leaves(node.right, out); } return;
    case 'ConditionalExpression': leaves(node.consequent, out); leaves(node.alternate, out); return;
    case 'LogicalExpression': leaves(node.left, out); leaves(node.right, out); return;
    case 'CallExpression': {
      const name = nameOf(node.callee);
      if (node.callee.type === 'Identifier' && ESCAPERS.has(name)) return;
      if (node.callee.type === 'MemberExpression' && node.callee.object.name === 'CF' && ESCAPING_MEMBERS.has(name)) return;
      if (NUMERIC.has(name)) return;
      if (name === 'join' && node.callee.object.type === 'CallExpression' && nameOf(node.callee.object.callee) === 'map') {
        const fn = node.callee.object.arguments[0];
        if (fn && /FunctionExpression$/.test(fn.type)) {
          if (fn.body.type !== 'BlockStatement') leaves(fn.body, out);
          else walk(fn.body, n => { if (n.type === 'ReturnStatement' && n.argument) leaves(n.argument, out); });
          return;
        }
      }
      out.push(node); return;
    }
    default: out.push(node);
  }
}

/** { 'scripts/pages/x.js': ['unescaped expression', …] } over every HTML sink */
function unescapedValues(uiRoot) {
  const result = {};
  for (const file of sourceFiles(uiRoot)) {
    const code = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
    const found = new Set();
    walk(ast.program, node => {
      let html = null;
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && ['innerHTML', 'outerHTML'].includes(nameOf(node.left))) html = node.right;
      if (node.type === 'CallExpression' && nameOf(node.callee) === 'insertAdjacentHTML') html = node.arguments[1];
      if (!html) return;
      const out = [];
      leaves(html, out);
      out.forEach(leaf => found.add(code.slice(leaf.start, leaf.end).replace(/\s+/g, ' ')));
    });
    if (found.size) result[path.relative(uiRoot, file).replace(/\\/g, '/')] = [...found].sort();
  }
  return result;
}

module.exports = { unescapedValues };
