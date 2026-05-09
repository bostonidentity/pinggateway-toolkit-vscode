import * as fs from 'fs/promises';
import * as path from 'path';
import { PathReference } from './types';
import { isIgnoredPath } from './groovyAnalyzer';

const PATH_RE = /["'](\/(?:opt|home|etc|var|usr|tmp|srv|root|mnt|media|boot|run)\/[a-zA-Z0-9._/-]+)["']/g;

export async function collectPathRefs(
  files: string[],
  ignorePaths: string[] = [],
): Promise<PathReference[]> {
  const map = new Map<string, { file: string; line: number }[]>();

  for (const f of files) {
    let content: string;
    try {
      content = await fs.readFile(f, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(PATH_RE)) {
        const p = m[1];
        if (isIgnoredPath(p, ignorePaths)) continue;
        const list = map.get(p) ?? [];
        list.push({ file: path.basename(f), line: i + 1 });
        map.set(p, list);
      }
    }
  }

  return Array.from(map.entries())
    .map(([p, refs]) => ({ path: p, refs }))
    .sort((a, b) => b.refs.length - a.refs.length);
}
