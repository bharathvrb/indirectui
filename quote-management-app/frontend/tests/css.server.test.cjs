'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Catches a half-deleted rule: stray declarations or an extra closing brace make the browser drop the NEXT rule.
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'css', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('every brace in app.css is balanced', () => {
    let depth = 0;
    css.split('\n').forEach((line, index) => {
        for (const ch of line) {
            depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
            assert.ok(depth >= 0, 'extra closing brace on line ' + (index + 1));
        }
    });
    assert.equal(depth, 0, 'unclosed block');
});

test('app.css has no declarations outside a rule', () => {
    let depth = 0;
    css.split('\n').forEach((line, index) => {
        if (depth === 0 && /^\s+[a-z-]+\s*:/.test(line)) {
            assert.fail('declaration outside a rule on line ' + (index + 1) + ': ' + line.trim().slice(0, 60));
        }
        for (const ch of line) {
            depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
        }
    });
});
