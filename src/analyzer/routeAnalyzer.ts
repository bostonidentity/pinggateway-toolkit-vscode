import { Issue, Rule } from './types';
import { REQUIRED_FIELDS } from './rules';
import { isIgnoredPath } from './groovyAnalyzer';

function deepFind(obj: unknown, key: string, path = ''): { path: string; value: unknown }[] {
  const results: { path: string; value: unknown }[] = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const current = path ? `${path}/${k}` : k;
      if (k === key) results.push({ path: current, value: v });
      results.push(...deepFind(v, key, current));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => results.push(...deepFind(item, key, `${path}[${i}]`)));
  }
  return results;
}

function deepGet(obj: unknown, slashPath: string): unknown {
  let current: unknown = obj;
  for (const part of slashPath.split('/')) {
    const m = part.match(/^(.+)\[(\d+)\]$/);
    if (m) {
      const [, k, idxStr] = m;
      const idx = Number(idxStr);
      if (current && typeof current === 'object' && !Array.isArray(current) && k in (current as object)) {
        current = (current as Record<string, unknown>)[k];
        if (Array.isArray(current) && idx < current.length) current = current[idx];
        else return undefined;
      } else return undefined;
    } else if (current && typeof current === 'object' && !Array.isArray(current) && part in (current as object)) {
      current = (current as Record<string, unknown>)[part];
    } else return undefined;
  }
  return current;
}

function findAllConditions(obj: unknown, path = ''): { path: string; value: string }[] {
  const results: { path: string; value: string }[] = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const current = path ? `${path}/${k}` : k;
      if (k === 'condition' && typeof v === 'string') results.push({ path: current, value: v });
      results.push(...findAllConditions(v, current));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => results.push(...findAllConditions(item, `${path}[${i}]`)));
  }
  return results;
}

function findLine(rawText: string, needle: string): number {
  const lines = rawText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return 0;
}

function findDuplicateKeys(text: string): { key: string; line: number }[] {
  const dups: { key: string; line: number }[] = [];
  const stack: Set<string>[] = [];
  let line = 1;
  let inStr = false;
  let strChar: string | null = null;
  let i = 0;

  const readKey = (start: number): { key: string; end: number } | null => {
    if (text[start] !== '"' && text[start] !== "'") return null;
    const quote = text[start];
    let j = start + 1;
    let k = '';
    while (j < text.length) {
      if (text[j] === '\\') { k += text[j + 1] ?? ''; j += 2; continue; }
      if (text[j] === quote) return { key: k, end: j };
      k += text[j];
      j++;
    }
    return null;
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n') line++;
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === strChar) { inStr = false; strChar = null; }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const k = readKey(i);
      if (k) {
        let j = k.end + 1;
        while (j < text.length && /\s/.test(text[j])) {
          if (text[j] === '\n') line++;
          j++;
        }
        if (text[j] === ':') {
          const top = stack[stack.length - 1];
          if (top) {
            if (top.has(k.key)) dups.push({ key: k.key, line });
            else top.add(k.key);
          }
          i = j + 1;
          continue;
        }
      }
      inStr = true;
      strChar = ch;
      i++;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '}') stack.pop();
    i++;
  }
  return dups;
}

export function analyzeRouteFile(
  routePath: string,
  rawText: string,
  rules: Rule[],
  allRouteNames: Map<string, string>,
  ignorePaths: string[] = [],
): Issue[] {
  const issues: Issue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return issues;
  }
  const rawLines = rawText.split(/\r?\n/);

  for (const dup of findDuplicateKeys(rawText)) {
    issues.push({
      ruleId: 'RT-001', severity: 'ERROR',
      filePath: routePath, line: dup.line,
      message: `Duplicate key '${dup.key}' in route JSON`,
      fix: 'Remove or rename the duplicate key',
      snippet: (rawLines[dup.line - 1] ?? '').trim(),
    });
  }

  const typeNodes = deepFind(parsed, 'type');
  for (const node of typeNodes) {
    if (typeof node.value !== 'string') continue;
    const required = REQUIRED_FIELDS[node.value];
    if (!required) continue;
    const parentPath = node.path.includes('/') ? node.path.replace(/\/[^/]+$/, '') : '';
    const parent = parentPath ? deepGet(parsed, parentPath) : parsed;
    if (!parent || typeof parent !== 'object') continue;
    for (const req of required) {
      if (deepGet(parent, req) === undefined) {
        const line = findLine(rawText, '"type"');
        issues.push({
          ruleId: 'RT-002', severity: 'ERROR',
          filePath: routePath, line,
          message: `${node.value} missing required field: ${req}`,
          fix: `Add '${req.split('/').pop()}' to ${node.value} config`,
          snippet: (rawLines[line - 1] ?? '').trim(),
        });
      }
    }
  }

  const routeName = (parsed as Record<string, unknown>)?.name;
  if (typeof routeName === 'string' && routeName) {
    const existing = allRouteNames.get(routeName);
    if (existing && existing !== routePath) {
      const line = findLine(rawText, '"name"');
      issues.push({
        ruleId: 'RT-101', severity: 'WARN',
        filePath: routePath, line,
        message: `Duplicate route name '${routeName}' (also in ${existing.split('/').pop()})`,
        fix: 'Rename one of the routes to avoid conflicts',
        snippet: (rawLines[line - 1] ?? '').trim(),
      });
    }
  }

  const conditions = findAllConditions(parsed);
  const rt102Lines = new Set<number>();
  for (const cond of conditions) {
    if (cond.value.includes('matches(')) {
      const line = findLine(rawText, cond.value.substring(0, 40));
      rt102Lines.add(line);
      issues.push({
        ruleId: 'RT-102', severity: 'WARN',
        filePath: routePath, line,
        message: 'matches() deprecated in PingGateway 2024.11',
        fix: 'Replace matches() with find() or matchesWithRegex()',
        snippet: (rawLines[line - 1] ?? '').trim(),
      });
    }
  }

  for (const m of rawText.matchAll(/\$\{([^}]+)\}/g)) {
    const expr = m[1];
    const pos = rawText.substring(0, m.index ?? 0).split('\n').length;
    if (rt102Lines.has(pos)) continue;
    if (expr.includes('matches(')) {
      issues.push({
        ruleId: 'RT-103', severity: 'WARN',
        filePath: routePath, line: pos,
        message: 'matches() deprecated in PingGateway 2024.11 (inline expression)',
        fix: 'Replace matches() with find() or matchesWithRegex()',
        snippet: (rawLines[pos - 1] ?? '').trim(),
      });
    }
    if (expr.includes('.get()')) {
      issues.push({
        ruleId: 'RT-103', severity: 'INFO',
        filePath: routePath, line: pos,
        message: 'Potential blocking .get() in inline expression',
        fix: 'Review if this is a Promise.get() call',
        snippet: (rawLines[pos - 1] ?? '').trim(),
      });
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    for (const rule of rules) {
      if (!rule.appliesTo.includes('json')) continue;
      const m = line.match(rule.pattern);
      if (!m) continue;
      if (rule.id === 'PATH-102' && isIgnoredPath(m[0], ignorePaths)) continue;
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        filePath: routePath,
        line: i + 1,
        message: rule.message,
        fix: rule.fix,
        snippet: line.trim(),
      });
    }
  }

  return issues;
}
