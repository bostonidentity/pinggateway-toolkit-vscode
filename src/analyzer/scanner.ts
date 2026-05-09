import * as fs from 'fs/promises';
import * as path from 'path';
import { AnalysisResult, Issue, ScanOptions, Severity } from './types';
import { RULES } from './rules';
import { analyzeGroovyFile } from './groovyAnalyzer';
import { analyzeRouteFile } from './routeAnalyzer';
import { collectRefs, refsAsIssues } from './scriptRefs';
import { collectPathRefs } from './pathRefs';
import { buildFileInventory } from './categorize';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.idea', '.vscode',
  'tmp', 'temp', '.tmp', '__pycache__', 'backup',
]);

async function* walk(dir: string, predicate: (name: string) => boolean): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name.toLowerCase())) continue;
      yield* walk(full, predicate);
    } else if (entry.isFile() && predicate(entry.name)) {
      yield full;
    }
  }
}

async function findGroovyFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for await (const f of walk(root, (n) => n.endsWith('.groovy'))) out.push(f);
  return out.sort();
}

async function findRouteFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for await (const f of walk(root, (n) => n.endsWith('.json'))) {
    const parts = path.relative(root, f).split(path.sep);
    if (parts.includes('routes')) out.push(f);
  }
  return out.sort();
}

async function findOtherJsonFiles(root: string, routeFiles: string[]): Promise<string[]> {
  const routeSet = new Set(routeFiles);
  const out: string[] = [];
  for await (const f of walk(root, (n) => n.endsWith('.json'))) {
    if (!routeSet.has(f)) out.push(f);
  }
  return out.sort();
}

async function readRouteName(file: string): Promise<string | null> {
  try {
    const content = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(content);
    const name = parsed?.name;
    return typeof name === 'string' && name ? name : null;
  } catch {
    return null;
  }
}

function countErrWarn(map: Map<string, Issue[]>): { errors: number; warnings: number } {
  let errors = 0, warnings = 0;
  for (const issues of map.values()) {
    for (const i of issues) {
      if (i.severity === 'ERROR') errors++;
      else if (i.severity === 'WARN') warnings++;
    }
  }
  return { errors, warnings };
}

export async function scanDirectory(
  rootPath: string,
  options: ScanOptions = {},
): Promise<AnalysisResult> {
  const disabledRules = new Set(options.disabledRules ?? []);
  const ignorePaths = options.ignorePaths ?? [];
  const activeRules = RULES.filter((r) => !disabledRules.has(r.id));

  const groovyFiles = await findGroovyFiles(rootPath);
  const routeFiles = await findRouteFiles(rootPath);
  const otherJsonFiles = await findOtherJsonFiles(rootPath, routeFiles);

  const allRouteNames = new Map<string, string>();
  for (const rf of routeFiles) {
    const name = await readRouteName(rf);
    if (name && !allRouteNames.has(name)) allRouteNames.set(name, rf);
  }

  // --- Run analyzers ---
  const groovyIssuesByFile = new Map<string, Issue[]>();
  for (const gf of groovyFiles) {
    let content: string;
    try { content = await fs.readFile(gf, 'utf8'); } catch { continue; }
    const issues = analyzeGroovyFile(gf, content, activeRules, ignorePaths);
    if (issues.length) groovyIssuesByFile.set(gf, issues);
  }

  const routeIssuesByFile = new Map<string, Issue[]>();
  for (const rf of routeFiles) {
    let content: string;
    try { content = await fs.readFile(rf, 'utf8'); } catch { continue; }
    const issues = analyzeRouteFile(rf, content, activeRules, allRouteNames, ignorePaths);
    if (issues.length) routeIssuesByFile.set(rf, issues);
  }

  const configIssuesByFile = new Map<string, Issue[]>();
  for (const cf of otherJsonFiles) {
    let content: string;
    try { content = await fs.readFile(cf, 'utf8'); } catch { continue; }
    const issues = analyzeRouteFile(cf, content, activeRules, new Map(), ignorePaths);
    if (issues.length) configIssuesByFile.set(cf, issues);
  }

  // --- Cross-file: orphan + dangling ---
  const allConfigFiles = [...routeFiles, ...otherJsonFiles];
  const refResult = await collectRefs(allConfigFiles, groovyFiles);
  const refIssuesAll = refsAsIssues(refResult).filter((i) => !disabledRules.has(i.ruleId));

  // Dangling refs are surfaced as issues on the config/route file that owns them
  for (const issue of refIssuesAll) {
    if (issue.ruleId === 'REF-001') {
      const target = routeFiles.includes(issue.filePath) ? routeIssuesByFile : configIssuesByFile;
      const list = target.get(issue.filePath) ?? [];
      list.push(issue);
      target.set(issue.filePath, list);
    }
  }

  // Partition script findings: used vs unused
  const scriptFindings = new Map<string, Issue[]>();
  const unusedFindings = new Map<string, Issue[]>();
  for (const [gf, issues] of groovyIssuesByFile) {
    if (refResult.usedScripts.has(gf)) scriptFindings.set(gf, issues);
    else unusedFindings.set(gf, issues);
  }
  // Orphan script REF-002 issues — attach to the unused script entry
  for (const issue of refIssuesAll) {
    if (issue.ruleId === 'REF-002') {
      const list = unusedFindings.get(issue.filePath) ?? [];
      list.push(issue);
      unusedFindings.set(issue.filePath, list);
    }
  }

  const scriptStats = countErrWarn(scriptFindings);
  const unusedStats = countErrWarn(unusedFindings);
  const routeStats = countErrWarn(routeIssuesByFile);
  const configStats = countErrWarn(configIssuesByFile);

  // --- Build flat issues list (used by Diagnostics + filter UI) ---
  const flatIssues: Issue[] = [];
  for (const issues of scriptFindings.values()) flatIssues.push(...issues);
  for (const issues of unusedFindings.values()) flatIssues.push(...issues);
  for (const issues of routeIssuesByFile.values()) flatIssues.push(...issues);
  for (const issues of configIssuesByFile.values()) flatIssues.push(...issues);

  const countsBySeverity: Record<Severity, number> = { ERROR: 0, WARN: 0, INFO: 0 };
  for (const i of flatIssues) countsBySeverity[i.severity]++;

  // --- Rule counts (for Triggered Rules section) ---
  const ruleCounts = new Map<string, number>();
  for (const i of flatIssues) {
    ruleCounts.set(i.ruleId, (ruleCounts.get(i.ruleId) ?? 0) + 1);
  }

  // --- File inventory (config / routes / scripts with valid/invalid) ---
  const fileInventory = await buildFileInventory(rootPath);
  fileInventory.scripts.in_use = refResult.usedScripts.size;
  fileInventory.routes.in_use = routeFiles.length;
  fileInventory.config.in_use = otherJsonFiles.length;

  // --- Path references aggregation ---
  const pathRefs = await collectPathRefs([...groovyFiles, ...allConfigFiles], ignorePaths);

  // --- Sort partitioned maps for stable rendering ---
  const sortMap = (m: Map<string, Issue[]>) =>
    new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));

  return {
    scanRoot: rootPath,
    scriptFindings: sortMap(scriptFindings),
    unusedFindings: sortMap(unusedFindings),
    routeFindings: sortMap(routeIssuesByFile),
    configFindings: sortMap(configIssuesByFile),
    usedScripts: refResult.usedScripts,
    unusedScripts: refResult.unusedScripts,
    danglingRefs: refResult.danglingRefs,
    fileInventory,
    pathRefs,
    ruleCounts,
    scriptErrors: scriptStats.errors + unusedStats.errors,
    scriptWarnings: scriptStats.warnings + unusedStats.warnings,
    configErrors: configStats.errors,
    configWarnings: configStats.warnings,
    routeErrors: routeStats.errors,
    routeWarnings: routeStats.warnings,
    scannedFiles: groovyFiles.length + routeFiles.length + otherJsonFiles.length,
    scannedGroovyFiles: groovyFiles.length,
    scannedRouteFiles: routeFiles.length,
    scannedConfigFiles: otherJsonFiles.length,
    orphanScripts: refResult.unusedScripts,
    issues: flatIssues,
    countsBySeverity,
    disabledRules: Array.from(disabledRules),
  };
}
