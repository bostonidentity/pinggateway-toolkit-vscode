import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInventory } from './types';

const VALID_EXTENSIONS = new Set([
  '.json', '.groovy', '.properties', '.xml', '.yml', '.yaml',
  '.conf', '.cfg', '.js', '.html', '.css', '.sh',
]);

const GARBAGE_EXTENSIONS = new Set([
  '.bak', '.old', '.orig', '.tmp', '.swp', '.swo', '.save', '.backup',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.idea', '.vscode',
  'tmp', 'temp', '.tmp', '__pycache__', 'backup',
]);

function isGarbage(name: string, ext: string): boolean {
  const lower = name.toLowerCase();
  if (GARBAGE_EXTENSIONS.has(ext)) return true;
  if (ext === '') return true;
  if (lower.endsWith('~')) return true;
  // Date-like extension: .20230426
  if (/^\.\d/.test(ext)) return true;
  // Embedded valid extension followed by junk (e.g. config.json.bak24SEP2022, route.json_bkpMar13)
  // Only triggers when the actual extension is NOT itself a valid one — otherwise .json
  // would falsely match (since ".json" contains ".js").
  if (!VALID_EXTENSIONS.has(ext)) {
    for (const ve of VALID_EXTENSIONS) {
      if (lower.includes(ve)) return true;
    }
  }
  return false;
}

async function* walkAll(dir: string, base: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name.toLowerCase())) continue;
      yield* walkAll(full, base);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

export async function buildFileInventory(rootPath: string): Promise<FileInventory> {
  const inv: FileInventory = {
    config: { path: 'config/', total: 0, valid: 0, invalid: 0, in_use: 0, valid_files: [], invalid_files: [] },
    routes: { path: 'config/routes/', total: 0, valid: 0, invalid: 0, in_use: 0, valid_files: [], invalid_files: [] },
    scripts: { path: 'scripts/', total: 0, valid: 0, invalid: 0, in_use: 0, valid_files: [], invalid_files: [] },
  };

  for await (const f of walkAll(rootPath, rootPath)) {
    const rel = path.relative(rootPath, f);
    const parts = rel.split(path.sep);
    let category: keyof FileInventory | null = null;
    if (parts.includes('routes')) category = 'routes';
    else if (parts.includes('scripts') || parts.includes('script')) category = 'scripts';
    else if (parts.includes('config') || parts[0] === 'config') category = 'config';
    if (!category) continue;

    const cat = inv[category];
    cat.total++;
    const ext = path.extname(f).toLowerCase();
    const garbage = isGarbage(path.basename(f), ext);
    if (VALID_EXTENSIONS.has(ext) && !garbage) {
      cat.valid++;
      cat.valid_files.push(rel);
    } else {
      cat.invalid++;
      cat.invalid_files.push(rel);
    }
  }
  return inv;
}
