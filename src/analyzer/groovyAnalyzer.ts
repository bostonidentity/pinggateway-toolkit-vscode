import { Issue, Rule } from './types';
import { stripComments } from './stripComments';

const REMOVED_CLASSES: { className: string; correctImport: string }[] = [
  { className: 'XmlSlurper', correctImport: 'groovy.xml.XmlSlurper' },
  { className: 'XmlParser', correctImport: 'groovy.xml.XmlParser' },
  { className: 'AntBuilder', correctImport: 'groovy.ant.AntBuilder' },
  { className: 'GroovyTestCase', correctImport: 'groovy.test.GroovyTestCase' },
];

export function isIgnoredPath(matched: string, ignorePaths: string[]): boolean {
  if (!ignorePaths.length) return false;
  const pathRe = /\/(?:opt|home|etc|var|usr|tmp|srv|root|mnt|media|boot|run)\/[a-zA-Z0-9._/-]+/;
  const pm = matched.match(pathRe);
  if (!pm) return false;
  const p = pm[0];
  return ignorePaths.some((ig) => p === ig || p.startsWith(ig + '/') || p.startsWith(ig));
}

export function analyzeGroovyFile(
  filePath: string,
  rawText: string,
  rules: Rule[],
  ignorePaths: string[] = [],
): Issue[] {
  const issues: Issue[] = [];
  const rawLines = rawText.split(/\r?\n/);
  const codeLines = stripComments(rawLines);

  for (const { lineNumber, code } of codeLines) {
    if (!code.trim()) continue;
    const rawLine = rawLines[lineNumber - 1] ?? '';
    for (const rule of rules) {
      if (!rule.appliesTo.includes('groovy')) continue;
      const m = code.match(rule.pattern);
      if (!m) continue;
      if (rule.id === 'PATH-102' && isIgnoredPath(m[0], ignorePaths)) continue;
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        line: lineNumber,
        message: rule.message,
        fix: rule.fix,
        snippet: rawLine.trim(),
      });
    }
  }

  // G4-106: removed class used in code outside import lines
  for (const { lineNumber, code } of codeLines) {
    if (!code.trim() || /^\s*import\s/.test(code)) continue;
    for (const { className, correctImport } of REMOVED_CLASSES) {
      const re = new RegExp(`\\b${className}\\b`);
      if (re.test(code)) {
        issues.push({
          ruleId: 'G4-106',
          severity: 'WARN',
          filePath,
          line: lineNumber,
          message: `${className} usage — verify import is from correct package`,
          fix: `Ensure import is: import ${correctImport}`,
          snippet: (rawLines[lineNumber - 1] ?? '').trim(),
        });
      }
    }
  }

  return issues;
}
