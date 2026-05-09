import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { scanDirectory } from '../../analyzer/scanner';
import { publishDiagnostics } from '../../diagnostics';
import { renderHtmlReport } from '../../ui/htmlReport';
import { AnalysisResult, Issue, Severity } from '../../analyzer/types';
import { RULES, PROCEDURAL_RULE_DESCS } from '../../analyzer/rules';

type SeverityFilter = Record<Severity, boolean>;

interface State {
  folder: string;
  result?: AnalysisResult;
  scanning: boolean;
  filter: SeverityFilter;
  disabledRules: Set<string>;
  ignorePaths: string[];
  autoOpenProblems: boolean;
}

const DEFAULT_FILTER: SeverityFilter = { ERROR: true, WARN: true, INFO: true };

let panel: vscode.WebviewPanel | undefined;
let configListener: vscode.Disposable | undefined;
let state: State = {
  folder: '',
  scanning: false,
  filter: { ...DEFAULT_FILTER },
  disabledRules: new Set(),
  ignorePaths: [],
  autoOpenProblems: true,
};

interface RuleMeta {
  id: string;
  severity?: Severity;
  description: string;
}

function readSettings(): { disabledRules: string[]; ignorePaths: string[]; autoOpenProblems: boolean } {
  const cfg = vscode.workspace.getConfiguration('iamToolkit.igUpgrade');
  return {
    disabledRules: cfg.get<string[]>('disabledRules', []),
    ignorePaths: cfg.get<string[]>('ignorePaths', []),
    autoOpenProblems: cfg.get<boolean>('autoOpenProblems', true),
  };
}

async function writeDisabledRules(list: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('iamToolkit.igUpgrade');
  await cfg.update('disabledRules', list);
}

async function writeIgnorePaths(list: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('iamToolkit.igUpgrade');
  await cfg.update('ignorePaths', list);
}

async function writeAutoOpenProblems(value: boolean): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('iamToolkit.igUpgrade');
  await cfg.update('autoOpenProblems', value);
}

function refreshFromSettings(): void {
  const s = readSettings();
  state.disabledRules = new Set(s.disabledRules);
  state.ignorePaths = s.ignorePaths;
  state.autoOpenProblems = s.autoOpenProblems;
}

function allRules(): RuleMeta[] {
  const out: RuleMeta[] = [];
  for (const r of RULES) {
    out.push({ id: r.id, severity: r.severity, description: r.message });
  }
  for (const [id, desc] of Object.entries(PROCEDURAL_RULE_DESCS)) {
    out.push({ id, description: desc });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function groupRulesByPrefix(): Map<string, RuleMeta[]> {
  const groups = new Map<string, RuleMeta[]>();
  for (const r of allRules()) {
    const prefix = r.id.split('-')[0];
    const list = groups.get(prefix) ?? [];
    list.push(r);
    groups.set(prefix, list);
  }
  return groups;
}

export async function openIgUpgradePanel(
  context: vscode.ExtensionContext,
  prefilledFolder?: vscode.Uri,
): Promise<void> {
  refreshFromSettings();

  const autoRun = !!prefilledFolder && prefilledFolder.fsPath !== state.folder;
  if (prefilledFolder) {
    state.folder = prefilledFolder.fsPath;
  }

  if (panel) {
    panel.reveal(vscode.ViewColumn.Active);
    panel.webview.html = renderHtml();
  } else {
    panel = vscode.window.createWebviewPanel(
      'iamToolkit.igUpgrade',
      'PingGateway Upgrade Analyzer',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.iconPath = new vscode.ThemeIcon('shield');

    configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (!panel) return;
      if (e.affectsConfiguration('iamToolkit.igUpgrade')) {
        refreshFromSettings();
        if (state.result) publishDiagnostics(context, filteredIssues());
        panel.webview.html = renderHtml();
      }
    });

    panel.onDidDispose(() => {
      panel = undefined;
      configListener?.dispose();
      configListener = undefined;
      state = {
        folder: '',
        scanning: false,
        filter: { ...DEFAULT_FILTER },
        disabledRules: new Set(),
        ignorePaths: [],
        autoOpenProblems: true,
      };
    });
    panel.webview.onDidReceiveMessage((msg) => handleMessage(context, msg));
    panel.webview.html = renderHtml();
  }

  if (autoRun) {
    void runScan(context);
  }
}

async function handleMessage(
  context: vscode.ExtensionContext,
  msg: {
    type: string;
    path?: string;
    severity?: Severity;
    rule?: string;
    paths?: string[];
  },
): Promise<void> {
  switch (msg.type) {
    case 'pickFolder': {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select',
        title: 'Select IG configuration directory',
      });
      if (picked && picked.length > 0) {
        state.folder = picked[0].fsPath;
        if (panel) panel.webview.html = renderHtml();
      }
      break;
    }
    case 'updateFolder': {
      state.folder = msg.path ?? '';
      break;
    }
    case 'runScan': {
      if (msg.path) state.folder = msg.path;
      void runScan(context);
      break;
    }
    case 'toggleSeverity': {
      if (!msg.severity) break;
      state.filter[msg.severity] = !state.filter[msg.severity];
      if (state.result) publishDiagnostics(context, filteredIssues());
      if (panel) panel.webview.html = renderHtml();
      break;
    }
    case 'toggleRule': {
      if (!msg.rule) break;
      if (state.disabledRules.has(msg.rule)) state.disabledRules.delete(msg.rule);
      else state.disabledRules.add(msg.rule);
      await writeDisabledRules(Array.from(state.disabledRules).sort());
      if (state.result) publishDiagnostics(context, filteredIssues());
      if (panel) panel.webview.html = renderHtml();
      break;
    }
    case 'saveIgnorePaths': {
      const list = (msg.paths ?? []).map((p) => p.trim()).filter((p) => p.length > 0);
      await writeIgnorePaths(list);
      // ignorePaths affects scan-time only — settings saved; re-run scan to apply
      vscode.window.showInformationMessage(
        `PingGateway Toolkit: ignore paths saved (${list.length}). Click Run scan to apply.`,
      );
      break;
    }
    case 'toggleAutoOpenProblems': {
      await writeAutoOpenProblems(!state.autoOpenProblems);
      // configListener will pick up the change and re-render
      break;
    }
    case 'export': {
      await exportReport();
      break;
    }
  }
}

function passesFilter(i: { severity: Severity; ruleId: string }): boolean {
  return state.filter[i.severity] && !state.disabledRules.has(i.ruleId);
}

function filteredIssues() {
  if (!state.result) return [];
  return state.result.issues.filter(passesFilter);
}

function filterMap(
  source: Map<string, ReturnType<() => Issue[]>>,
): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  for (const [k, v] of source) {
    const kept = v.filter(passesFilter);
    if (kept.length) out.set(k, kept);
  }
  return out;
}

function countErrWarnFromMap(map: Map<string, Issue[]>): { errors: number; warnings: number } {
  let errors = 0, warnings = 0;
  for (const list of map.values()) {
    for (const i of list) {
      if (i.severity === 'ERROR') errors++;
      else if (i.severity === 'WARN') warnings++;
    }
  }
  return { errors, warnings };
}

function filteredResult(): AnalysisResult | undefined {
  if (!state.result) return undefined;
  const r = state.result;
  const scriptFindings = filterMap(r.scriptFindings);
  const unusedFindings = filterMap(r.unusedFindings);
  const routeFindings = filterMap(r.routeFindings);
  const configFindings = filterMap(r.configFindings);
  const flatIssues = r.issues.filter(passesFilter);
  const counts: Record<Severity, number> = { ERROR: 0, WARN: 0, INFO: 0 };
  for (const i of flatIssues) counts[i.severity]++;
  const scriptStats = countErrWarnFromMap(scriptFindings);
  const unusedStats = countErrWarnFromMap(unusedFindings);
  const routeStats = countErrWarnFromMap(routeFindings);
  const configStats = countErrWarnFromMap(configFindings);
  const ruleCounts = new Map<string, number>();
  for (const i of flatIssues) ruleCounts.set(i.ruleId, (ruleCounts.get(i.ruleId) ?? 0) + 1);
  return {
    ...r,
    scriptFindings,
    unusedFindings,
    routeFindings,
    configFindings,
    issues: flatIssues,
    countsBySeverity: counts,
    scriptErrors: scriptStats.errors + unusedStats.errors,
    scriptWarnings: scriptStats.warnings + unusedStats.warnings,
    routeErrors: routeStats.errors,
    routeWarnings: routeStats.warnings,
    configErrors: configStats.errors,
    configWarnings: configStats.warnings,
    ruleCounts,
    disabledRules: Array.from(state.disabledRules),
  };
}

async function runScan(context: vscode.ExtensionContext): Promise<void> {
  if (!state.folder) {
    vscode.window.showWarningMessage('PingGateway Toolkit: please choose a folder first.');
    return;
  }
  state.scanning = true;
  if (panel) panel.webview.html = renderHtml();

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'PingGateway Toolkit: Running upgrade scan...',
      cancellable: false,
    },
    () =>
      scanDirectory(state.folder, {
        disabledRules: Array.from(state.disabledRules),
        ignorePaths: state.ignorePaths,
      }),
  );

  state.result = result;
  state.scanning = false;
  const visibleIssues = filteredIssues();
  publishDiagnostics(context, visibleIssues);
  if (panel) panel.webview.html = renderHtml();

  if (state.autoOpenProblems && visibleIssues.length > 0) {
    void vscode.commands.executeCommand('workbench.actions.view.problems');
  }

  const summary =
    result.issues.length === 0
      ? `PingGateway Toolkit: scanned ${result.scannedFiles} file(s), no issues found.`
      : `PingGateway Toolkit: ${result.issues.length} issue(s) in ${result.scannedFiles} file(s) — see Problems panel & report.`;
  vscode.window.showInformationMessage(summary);
}

async function exportReport(): Promise<void> {
  const view = filteredResult();
  if (!view) return;
  const defaultName = `pinggateway-upgrade-${path.basename(view.scanRoot)}-${timestamp()}.html`;
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(view.scanRoot, defaultName)),
    filters: { HTML: ['html'] },
  });
  if (!target) return;
  const html = renderHtmlReport(view, { withExportButton: false });
  await fs.writeFile(target.fsPath, html, 'utf8');
  const open = 'Open File';
  const action = await vscode.window.showInformationMessage(
    `Report exported to ${target.fsPath}`,
    open,
  );
  if (action === open) {
    void vscode.env.openExternal(target);
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(): string {
  const folder = escapeHtml(state.folder);
  const view = filteredResult();
  const hasResult = !!view && !state.scanning;
  const summary = hasResult ? renderSummary(view!) : '';
  const filterRow = state.result ? renderFilterRow() : '';
  const exportBtn = hasResult
    ? `<button id="export" class="secondary">Export to HTML</button>`
    : '';
  const reportArea = state.scanning
    ? `<div class="placeholder">Scanning…</div>`
    : hasResult
      ? `<iframe srcdoc="${escapeHtml(renderHtmlReport(view!, { withExportButton: false }))}"></iframe>`
      : `<div class="placeholder">No scan run yet. Pick a directory and click <b>Run scan</b>.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  padding: 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 32px);
  box-sizing: border-box;
}
h2 { margin: 0 0 4px 0; }
.subtitle {
  color: var(--vscode-descriptionForeground);
  margin: 0 0 16px 0;
  font-size: 13px;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}
input[type=text] {
  flex: 1;
  min-width: 240px;
  padding: 4px 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  font-family: var(--vscode-font-family);
  outline: none;
}
input[type=text]:focus {
  border-color: var(--vscode-focusBorder);
}
button {
  padding: 4px 14px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  cursor: pointer;
  font-family: var(--vscode-font-family);
}
button:hover { background: var(--vscode-button-hoverBackground); }
button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.filters {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--vscode-foreground);
  flex-wrap: wrap;
}
.filter-label { color: var(--vscode-descriptionForeground); }
.check { cursor: pointer; user-select: none; }
.check input { margin-right: 4px; vertical-align: middle; }
.summary {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  flex-wrap: wrap;
}
.summary .num {
  font-weight: 600;
  color: var(--vscode-foreground);
}
.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vscode-descriptionForeground);
  background: var(--vscode-editor-background);
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 4px;
  font-size: 14px;
}
iframe {
  flex: 1;
  width: 100%;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: white;
}
details.settings {
  margin: 0 0 12px 0;
  padding: 8px 12px;
  background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,0.08));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  font-size: 13px;
}
details.settings summary {
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}
details.settings summary .hint {
  font-weight: normal;
  color: var(--vscode-descriptionForeground);
  margin-left: 8px;
}
.settings-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.settings-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
}
.rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.rule-group-title {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.rule-group label {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 2px 0;
  font-size: 12px;
  cursor: pointer;
}
.rule-group label .rule-id {
  font-family: monospace;
  color: var(--vscode-foreground);
  min-width: 70px;
}
.rule-group label .rule-desc {
  color: var(--vscode-descriptionForeground);
  flex: 1;
}
.rule-group label.disabled .rule-id,
.rule-group label.disabled .rule-desc {
  text-decoration: line-through;
  opacity: 0.55;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 12px;
  resize: vertical;
  outline: none;
}
textarea:focus { border-color: var(--vscode-focusBorder); }
.settings-section .actions {
  margin-top: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.settings-section .saved-hint {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
</style>
</head>
<body>
<h2>PingGateway Upgrade Analyzer</h2>
<p class="subtitle">Compatibility scanner for Identity Gateway scripts, routes, and configs.</p>
<div class="toolbar">
  <input type="text" id="folder" placeholder="IG configuration directory…" value="${folder}">
  <button class="secondary" id="browse">Browse…</button>
  <button id="run">Run scan</button>
  ${exportBtn}
</div>
${renderSettingsPanel()}
${filterRow}
${summary}
${reportArea}
<script>
const vscode = acquireVsCodeApi();
const folderInput = document.getElementById('folder');
folderInput.addEventListener('input', () => {
  vscode.postMessage({ type: 'updateFolder', path: folderInput.value });
});
folderInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') vscode.postMessage({ type: 'runScan', path: folderInput.value });
});
document.getElementById('browse').addEventListener('click', () => {
  vscode.postMessage({ type: 'pickFolder' });
});
document.getElementById('run').addEventListener('click', () => {
  vscode.postMessage({ type: 'runScan', path: folderInput.value });
});
const exportBtn = document.getElementById('export');
if (exportBtn) {
  exportBtn.addEventListener('click', () => vscode.postMessage({ type: 'export' }));
}
document.querySelectorAll('.severity-filter input[type=checkbox]').forEach((el) => {
  el.addEventListener('change', () => {
    vscode.postMessage({ type: 'toggleSeverity', severity: el.getAttribute('data-sev') });
  });
});
document.querySelectorAll('.rule-toggle').forEach((el) => {
  el.addEventListener('change', () => {
    vscode.postMessage({ type: 'toggleRule', rule: el.getAttribute('data-rule') });
  });
});
const ignoreTextarea = document.getElementById('ignorePaths');
const saveIgnoreBtn = document.getElementById('saveIgnorePaths');
if (saveIgnoreBtn && ignoreTextarea) {
  saveIgnoreBtn.addEventListener('click', () => {
    const lines = ignoreTextarea.value.split(/\\r?\\n/);
    vscode.postMessage({ type: 'saveIgnorePaths', paths: lines });
  });
}
const autoOpenCheckbox = document.getElementById('autoOpenProblems');
if (autoOpenCheckbox) {
  autoOpenCheckbox.addEventListener('change', () => {
    vscode.postMessage({ type: 'toggleAutoOpenProblems' });
  });
}
</script>
</body>
</html>`;
}

function renderSummary(result: AnalysisResult): string {
  const {
    scannedFiles,
    scannedGroovyFiles,
    scannedRouteFiles,
    scannedConfigFiles,
    issues,
    countsBySeverity,
    unusedScripts,
    danglingRefs,
  } = result;
  return `<div class="summary">
    <span><span class="num">${scannedFiles}</span> total</span>
    <span><span class="num">${scannedGroovyFiles}</span> groovy</span>
    <span><span class="num">${scannedRouteFiles}</span> routes</span>
    <span><span class="num">${scannedConfigFiles}</span> configs</span>
    <span style="margin-left:16px"><span class="num">${countsBySeverity.ERROR}</span> errors</span>
    <span><span class="num">${countsBySeverity.WARN}</span> warnings</span>
    <span><span class="num">${countsBySeverity.INFO}</span> info</span>
    <span><span class="num">${unusedScripts.length}</span> orphans</span>
    <span><span class="num">${danglingRefs.length}</span> dangling</span>
    <span style="margin-left:auto"><span class="num">${issues.length}</span> total issues</span>
  </div>`;
}

function renderFilterRow(): string {
  const cb = (sev: Severity, label: string) =>
    `<label class="check"><input type="checkbox" data-sev="${sev}"${state.filter[sev] ? ' checked' : ''}> ${label}</label>`;
  return `<div class="filters severity-filter">
    <span class="filter-label">Show:</span>
    ${cb('ERROR', 'Errors')}
    ${cb('WARN', 'Warnings')}
    ${cb('INFO', 'Info')}
  </div>`;
}

function renderSettingsPanel(): string {
  const groups = groupRulesByPrefix();
  const groupOrder = ['G4', 'IG', 'SEC', 'PATH', 'RT', 'REF'];
  const groupBlocks: string[] = [];
  for (const prefix of groupOrder) {
    const list = groups.get(prefix);
    if (!list) continue;
    const items = list
      .map((r) => {
        const enabled = !state.disabledRules.has(r.id);
        return `<label class="${enabled ? '' : 'disabled'}">
          <input type="checkbox" class="rule-toggle" data-rule="${escapeHtml(r.id)}"${enabled ? ' checked' : ''}>
          <span class="rule-id">${escapeHtml(r.id)}</span>
          <span class="rule-desc">${escapeHtml(r.description)}</span>
        </label>`;
      })
      .join('');
    groupBlocks.push(`<div class="rule-group">
      <div class="rule-group-title">${prefix}</div>
      ${items}
    </div>`);
  }
  const disabledCount = state.disabledRules.size;
  const ignoreLines = escapeHtml(state.ignorePaths.join('\n'));
  const autoOpenHint = state.autoOpenProblems ? '' : ' · auto-open off';
  return `<details class="settings">
    <summary>Settings <span class="hint">${disabledCount} rule${disabledCount === 1 ? '' : 's'} disabled · ${state.ignorePaths.length} ignore path${state.ignorePaths.length === 1 ? '' : 's'}${autoOpenHint}</span></summary>
    <div class="settings-body">
      <div class="settings-section">
        <h4>Preferences</h4>
        <label class="check"><input type="checkbox" id="autoOpenProblems"${state.autoOpenProblems ? ' checked' : ''}> Auto-open Problems panel after scan</label>
      </div>
      <div class="settings-section">
        <h4>Disabled rules <span class="filter-label">(uncheck to skip)</span></h4>
        <div class="rule-grid">
          ${groupBlocks.join('')}
        </div>
      </div>
      <div class="settings-section">
        <h4>Ignore paths <span class="filter-label">(one per line, applied to PATH-102)</span></h4>
        <textarea id="ignorePaths" rows="4" placeholder="/opt/logs&#10;/var/log">${ignoreLines}</textarea>
        <div class="actions">
          <button id="saveIgnorePaths" class="secondary">Save paths</button>
          <span class="saved-hint">Re-run scan to apply.</span>
        </div>
      </div>
    </div>
  </details>`;
}
