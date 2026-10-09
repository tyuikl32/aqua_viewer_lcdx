import fs from 'node:fs';
import path from 'node:path';
// @babel/parser is already provided by the locked @vitejs/plugin-react dependency tree.
import { parse } from '@babel/parser';

function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string') result[name] = item;
    else flatten(item, name, result);
  }
  return result;
}

const files = [
  'src/i18n/zh.json',
  'src/i18n/en.json',
  'public/assets/i18n/zh.json',
  'public/assets/i18n/en.json',
];
const raw = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const resources = raw.map((value) => flatten(value));
const errors = [];

for (let i = 1; i < resources.length; i++) {
  const keys = new Set([...Object.keys(resources[0]), ...Object.keys(resources[i])]);
  for (const key of keys) {
    if (!(key in resources[0]) || !(key in resources[i])) {
      errors.push({ kind: 'missing-resource-key', file: files[i], key });
    }
  }
}
for (const i of [0, 1]) {
  for (const key of Object.keys(resources[i])) {
    if (resources[i][key] !== resources[i + 2][key]) {
      errors.push({ kind: 'public-copy-drift', file: files[i], key });
    }
  }
}
const variables = (text) => [...text.matchAll(/[{][{](.*?)[}][}]/g)]
  .map((match) => match[1].trim()).sort().join(',');
for (const key of Object.keys(resources[0])) {
  if (variables(resources[0][key]) !== variables(resources[1][key] ?? '')) {
    errors.push({ kind: 'interpolation-drift', key });
  }
}

const roots = new Set(Object.keys(raw[0]));
const prefixes = new Set();
for (const key of Object.keys(resources[0])) {
  const parts = key.split('.');
  for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join('.'));
}
let staticCalls = 0;
let declaredKeys = 0;
const dynamicCalls = [];
function checkKey(key, file, line) {
  if (!(key in resources[0])) errors.push({ kind: 'missing-source-key', file, line, key });
}
function visit(node, file, text) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && ['t', 'translate'].includes(node.callee?.name)) {
    const key = node.arguments[0];
    if (key?.type === 'StringLiteral') {
      staticCalls++;
      checkKey(key.value, file, node.loc.start.line);
    } else {
      // Dynamic suffix domains still need semantic review; never claim this proves them all.
      dynamicCalls.push({ file, line: node.loc.start.line, expression: text.slice(key?.start, key?.end) });
    }
  } else if (node.type === 'StringLiteral') {
    // Also cover catalog labelKey declarations and literal arms of conditional t() calls.
    const key = node.value;
    if (key.includes('.') && roots.has(key.split('.')[0]) && !prefixes.has(key) && !prefixes.has(key.replace(/\.$/, ''))) {
      declaredKeys++;
      checkKey(key, file, node.loc.start.line);
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, file, text));
    else if (value?.type) visit(value, file, text);
  }
}
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(file);
    } else if (/\.tsx?$/.test(file)) {
      const text = fs.readFileSync(file, 'utf8');
      const ast = parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
      visit(ast, file, text);
    }
  }
}
scan('src');
console.log(JSON.stringify({
  keys: resources.map((resource) => Object.keys(resource).length),
  staticCalls,
  declaredKeys,
  dynamicCallCount: dynamicCalls.length,
  ...(process.argv.includes('--dynamic') ? { dynamicCalls } : {}),
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
