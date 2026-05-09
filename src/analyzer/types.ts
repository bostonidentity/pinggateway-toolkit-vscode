export type Severity = 'ERROR' | 'WARN' | 'INFO';

export type FileKind = 'groovy' | 'json';

export interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  fix: string;
  appliesTo: FileKind[];
}

export interface Issue {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number;
  message: string;
  fix: string;
  snippet: string;
}

export interface ScanOptions {
  disabledRules?: string[];
  ignorePaths?: string[];
}

export interface FileCategoryInventory {
  path: string;
  total: number;
  valid: number;
  invalid: number;
  in_use: number;
  valid_files: string[];
  invalid_files: string[];
}

export interface FileInventory {
  config: FileCategoryInventory;
  routes: FileCategoryInventory;
  scripts: FileCategoryInventory;
}

export interface PathReference {
  path: string;
  refs: { file: string; line: number }[];
}

export interface DanglingRef {
  routeFile: string;
  missingTarget: string;
  line: number;
}

export interface AnalysisResult {
  scanRoot: string;

  // Partitioned findings by file kind
  scriptFindings: Map<string, Issue[]>;     // .groovy referenced by some config
  unusedFindings: Map<string, Issue[]>;     // .groovy not referenced
  routeFindings: Map<string, Issue[]>;      // routes/*.json
  configFindings: Map<string, Issue[]>;     // other .json/.properties/.xml

  // Cross-file
  usedScripts: Map<string, string[]>;       // script absolute path → list of config file basenames
  unusedScripts: string[];
  danglingRefs: DanglingRef[];

  // Inventory + path refs + rule counts
  fileInventory: FileInventory;
  pathRefs: PathReference[];
  ruleCounts: Map<string, number>;

  // Per-category stats
  scriptErrors: number;
  scriptWarnings: number;
  configErrors: number;
  configWarnings: number;
  routeErrors: number;
  routeWarnings: number;

  // Flat list (for Diagnostics + filter UI)
  scannedFiles: number;
  scannedGroovyFiles: number;
  scannedRouteFiles: number;
  scannedConfigFiles: number;
  orphanScripts: string[];
  issues: Issue[];
  countsBySeverity: Record<Severity, number>;

  // For appendix (which rules user disabled)
  disabledRules: string[];
}
