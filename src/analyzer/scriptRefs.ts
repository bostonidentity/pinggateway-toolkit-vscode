import * as fs from 'fs/promises';
import * as path from 'path';
import { Issue, DanglingRef } from './types';

export interface RefScanResult {
  // script absolute path → list of config file basenames that reference it
  usedScripts: Map<string, string[]>;
  unusedScripts: string[];
  danglingRefs: DanglingRef[];
}

function matchesScript(scriptPath: string, ref: string): boolean {
  const base = path.basename(scriptPath);
  return (
    base === ref ||
    scriptPath.endsWith('/' + ref) ||
    scriptPath.endsWith(ref) ||
    scriptPath.includes(ref)
  );
}

export async function collectRefs(
  configFiles: string[],
  scriptFiles: string[],
): Promise<RefScanResult> {
  const usedScripts = new Map<string, string[]>();
  const danglingRefs: DanglingRef[] = [];

  // Build a quick basename → script-path map for dangling lookup
  const knownBasenames = new Set(scriptFiles.map((sf) => path.basename(sf)));

  // For each config file, extract refs and pair them to scripts
  for (const cf of configFiles) {
    let content: string;
    try {
      content = await fs.readFile(cf, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    const explicitRefs = new Set<string>();
    for (const m of content.matchAll(
      /"(?:file|source|scriptFile)"\s*:\s*"([^"]*\.(?:groovy|js))"/g,
    )) {
      if (m[1]) explicitRefs.add(m[1]);
    }
    const looseRefs = new Set<string>();
    for (const m of content.matchAll(/(\w+\.(?:groovy|js))/g)) {
      if (m[1]) looseRefs.add(m[1]);
    }
    const allRefs = new Set<string>([...explicitRefs, ...looseRefs]);

    // Mark used scripts
    for (const ref of allRefs) {
      for (const sf of scriptFiles) {
        if (matchesScript(sf, ref)) {
          const list = usedScripts.get(sf) ?? [];
          if (!list.includes(path.basename(cf))) list.push(path.basename(cf));
          usedScripts.set(sf, list);
        }
      }
    }

    // Dangling: explicit reference to a script we cannot find
    for (const ref of explicitRefs) {
      if (!knownBasenames.has(ref) && !scriptFiles.some((sf) => matchesScript(sf, ref))) {
        const lineIdx = lines.findIndex((l) => l.includes(`"${ref}"`));
        if (lineIdx >= 0) {
          danglingRefs.push({ routeFile: cf, missingTarget: ref, line: lineIdx + 1 });
        }
      }
    }
  }

  const unusedScripts = scriptFiles.filter((sf) => !usedScripts.has(sf));
  return { usedScripts, unusedScripts, danglingRefs };
}

export function refsAsIssues(result: RefScanResult): Issue[] {
  const issues: Issue[] = [];
  for (const orphan of result.unusedScripts) {
    issues.push({
      ruleId: 'REF-002',
      severity: 'INFO',
      filePath: orphan,
      line: 1,
      message: 'Orphan script — not referenced by any route or config',
      fix: 'Remove this script if unused, or add a reference from a route/config',
      snippet: path.basename(orphan),
    });
  }
  for (const d of result.danglingRefs) {
    issues.push({
      ruleId: 'REF-001',
      severity: 'ERROR',
      filePath: d.routeFile,
      line: d.line,
      message: `Dangling script reference: ${d.missingTarget} not found in scripts/`,
      fix: 'Create the referenced script, fix the path, or remove the reference',
      snippet: `"${d.missingTarget}"`,
    });
  }
  return issues;
}
