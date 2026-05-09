import * as path from 'path';
import { AnalysisResult, Issue, Severity, FileCategoryInventory } from '../analyzer/types';
import { RULES, PROCEDURAL_RULE_DESCS } from '../analyzer/rules';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function num(n: number): string {
  return n === 0 ? `<span class="zero">0</span>` : String(n);
}

function err(n: number): string {
  return n === 0 ? `<span class="zero">0</span>` : `<span class="sev-error">${n}</span>`;
}

function warn(n: number): string {
  return n === 0 ? `<span class="zero">0</span>` : `<span class="sev-warn">${n}</span>`;
}

function severityBadge(sev: Severity): string {
  const cls = sev === 'ERROR' ? 'badge-error' : sev === 'WARN' ? 'badge-warn' : 'badge-info';
  return `<span class="badge ${cls}">${sev}</span>`;
}

function collapsibleList(items: string[], threshold = 3): string {
  const escaped = items.map(escapeHtml);
  if (escaped.length <= threshold) return escaped.join('<br>');
  const visible = escaped.slice(0, threshold).join('<br>');
  const hidden = escaped.slice(threshold).join('<br>');
  return `${visible}<details style="margin-top:2px"><summary style="cursor:pointer;color:#2b6cb0;font-size:11px">+${escaped.length - threshold} more</summary>${hidden}</details>`;
}

function findingsTable(findings: Issue[]): string {
  const out: string[] = [];
  out.push('<table><tr><th style="white-space:nowrap">Line</th><th style="white-space:nowrap">Severity</th><th style="white-space:nowrap">Rule</th><th>Issue</th><th>Fix</th></tr>');
  for (const f of findings) {
    const ln = f.line || '-';
    out.push(`<tr><td>${ln}</td><td>${severityBadge(f.severity)}</td><td>${escapeHtml(f.ruleId)}</td><td>${escapeHtml(f.message)}</td><td>${escapeHtml(f.fix)}</td></tr>`);
  }
  out.push('</table>');
  const affected = findings.filter((f) => f.snippet);
  if (affected.length) {
    out.push('<details><summary>Affected lines</summary><pre>');
    for (const f of affected) {
      out.push(`// Line ${f.line}: [${f.severity}] ${f.ruleId}`);
      out.push(escapeHtml(f.snippet));
    }
    out.push('</pre></details>');
  }
  return out.join('\n');
}

function fileListTable(inv: FileCategoryInventory, useFullPath: boolean): string {
  const valid = inv.valid_files;
  const invalid = inv.invalid_files;
  if (valid.length === 0 && invalid.length === 0) {
    return `<p style="color:#718096">No files found.</p>`;
  }
  const out: string[] = ['<table><tr><th>File</th><th>Status</th></tr>'];
  for (const f of valid) {
    const display = useFullPath ? f : path.basename(f);
    out.push(`<tr><td><code>${escapeHtml(display)}</code></td><td>Valid</td></tr>`);
  }
  for (const f of invalid) {
    const display = useFullPath ? f : path.basename(f);
    out.push(`<tr><td><code>${escapeHtml(display)}</code></td><td><span style="color:#d97706">Invalid</span></td></tr>`);
  }
  out.push('</table>');
  return out.join('\n');
}

export function renderHtmlReport(
  result: AnalysisResult,
  options: { withExportButton: boolean },
): string {
  const h: string[] = [];
  const inv = result.fileInventory;

  // ===== Header =====
  h.push(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>PingGateway Upgrade Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px 40px; background: #f5f6f8; color: #2d3748; line-height: 1.6; max-width: 1100px; margin: 0 auto; }
  h1 { color: #1a202c; font-size: 22px; border-bottom: 2px solid #4a5568; padding-bottom: 8px; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #718096; margin-bottom: 16px; }
  h2 { margin-top: 8px; margin-bottom: 8px; color: #2d3748; font-size: 16px; border-bottom: 1px solid #cbd5e0; padding-bottom: 4px; }
  h3 { margin-top: 20px; margin-bottom: 6px; color: #2d3748; font-size: 18px; }
  h3 code { font-size: 17px; background: #ebf4ff; color: #2b6cb0; padding: 3px 10px; border-radius: 4px; border: 1px solid #bee3f8; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
  th { background: #edf2f7; color: #2d3748; padding: 7px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e0; }
  td { padding: 5px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f7fafc; }
  tr:hover td { background: #edf2f7; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  td:nth-child(1), td:nth-child(2), td:nth-child(3) { white-space: nowrap; }
  .sev-error { color: #c53030; font-weight: 600; }
  .sev-warn { color: #b7791f; font-weight: 600; }
  .sev-info { color: #2b6cb0; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }
  .badge-error { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
  .badge-warn { background: #fffff0; color: #975a16; border: 1px solid #fefcbf; }
  .badge-info { background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
  .zero { color: #a0aec0; }
  code { background: #edf2f7; padding: 1px 5px; border-radius: 3px; font-size: 12px; color: #4a5568; }
  details { margin: 6px 0; }
  summary { cursor: pointer; font-weight: 600; color: #4a5568; font-size: 12px; }
  summary:hover { color: #2d3748; }
  pre { background: #2d3748; color: #e2e8f0; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
  .note { background: #f7fafc; border-left: 3px solid #4a90d9; padding: 8px 12px; margin: 10px 0; font-size: 12px; color: #4a5568; }
  .invalid-list { font-size: 12px; color: #718096; }
  .section { background: #fff; border-radius: 6px; padding: 12px 20px; margin: 8px 0; border: 1px solid #e2e8f0; }
  .export-btn { float: right; padding: 6px 14px; background: #2b6cb0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .export-btn:hover { background: #1e4e8c; }
</style></head><body>`);

  if (options.withExportButton) {
    h.push(`<button class="export-btn" onclick="exportReport()">Export to HTML</button>`);
  }
  h.push(`<h1>PingGateway Upgrade Report</h1>`);
  h.push(`<div class="subtitle">Generated: ${nowStamp()}</div>`);

  // ===== Table of Contents =====
  h.push('<div class="section">');
  h.push('<h2>Table of Contents</h2>');
  h.push('<ol style="font-size:14px">');
  h.push('<li><a href="#overview">Overview</a></li>');
  h.push('<li><a href="#global-config">Global Config</a><ol>'
    + '<li><a href="#gc-filelist">File List (valid &amp; invalid)</a></li>'
    + '<li><a href="#gc-findings">Finding Details</a></li></ol></li>');
  h.push('<li><a href="#scripts">Scripts</a><ol>'
    + '<li><a href="#sc-filelist">File List (valid &amp; invalid)</a></li>'
    + '<li><a href="#sc-usage">Usage</a></li>'
    + '<li><a href="#sc-findings">Finding Details</a></li></ol></li>');
  h.push('<li><a href="#routes">Routes</a><ol>'
    + '<li><a href="#rt-filelist">File List (valid &amp; invalid)</a></li>'
    + '<li><a href="#rt-findings">Finding Details</a></li></ol></li>');
  h.push('<li><a href="#summary">Summary</a><ol>'
    + '<li><a href="#files-to-fix">Files to Review &amp; Fix</a></li>'
    + '<li><a href="#statistics">Triggered Rules</a></li>'
    + '<li><a href="#path-refs">Path References</a></li>'
    + '<li><a href="#garbage">Invalid/Garbage Files</a></li></ol></li>');
  h.push('<li><a href="#appendix">Appendix: Scanning Rules</a></li>');
  h.push('</ol></div>');

  // ===== 1. Overview =====
  h.push('<div class="section" id="overview">');
  h.push('<h2>1. Overview</h2>');
  h.push('<table><tr><th>Category</th><th>Path</th><th class="num">Total</th><th class="num">Valid</th><th class="num">Invalid</th><th class="num">In Use</th><th class="num">Not In Use</th><th class="num">Errors</th><th class="num">Warnings</th></tr>');
  const rows: [string, FileCategoryInventory, number, number][] = [
    ['Global config', inv.config, result.configErrors, result.configWarnings],
    ['Routes', inv.routes, result.routeErrors, result.routeWarnings],
    ['Scripts', inv.scripts, result.scriptErrors, result.scriptWarnings],
  ];
  let tTotal = 0, tValid = 0, tInvalid = 0, tInUse = 0, tNotInUse = 0, tErr = 0, tWarn = 0;
  for (const [label, cat, e, w] of rows) {
    const niu = cat.valid > cat.in_use ? cat.valid - cat.in_use : 0;
    h.push(`<tr><td><strong>${label}</strong></td><td><code>${escapeHtml(cat.path)}</code></td>`
      + `<td class="num">${cat.total}</td><td class="num">${num(cat.valid)}</td><td class="num">${num(cat.invalid)}</td>`
      + `<td class="num">${num(cat.in_use)}</td><td class="num">${num(niu)}</td>`
      + `<td class="num">${err(e)}</td><td class="num">${warn(w)}</td></tr>`);
    tTotal += cat.total; tValid += cat.valid; tInvalid += cat.invalid;
    tInUse += cat.in_use; tNotInUse += niu; tErr += e; tWarn += w;
  }
  h.push(`<tr style="font-weight:bold;border-top:2px solid #94a3b8"><td>Total</td><td></td>`
    + `<td class="num">${tTotal}</td><td class="num">${tValid}</td><td class="num">${tInvalid}</td>`
    + `<td class="num">${tInUse}</td><td class="num">${tNotInUse}</td>`
    + `<td class="num">${err(tErr)}</td><td class="num">${warn(tWarn)}</td></tr>`);
  h.push('</table>');
  h.push('<div class="note">'
    + '<table style="border:none;margin:0;font-size:12px;width:auto">'
    + '<tr><td style="border:none;padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap">Valid</td><td style="border:none;padding:2px 0">Files with recognized extensions (.json, .groovy, .properties, .xml, etc.)</td></tr>'
    + '<tr><td style="border:none;padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap">Invalid</td><td style="border:none;padding:2px 0">Garbage/backup files (.bak, .old, .tmp, no extension, etc.)</td></tr>'
    + '<tr><td style="border:none;padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap">In Use</td><td style="border:none;padding:2px 0">Scripts referenced by config files; routes and configs are all considered in use</td></tr>'
    + '<tr><td style="border:none;padding:2px 8px 2px 0;font-weight:bold;white-space:nowrap">Not In Use</td><td style="border:none;padding:2px 0">Valid files not referenced by any config (may be indirectly used)</td></tr>'
    + '</table>'
    + '<div style="margin-top:6px;font-size:11px;color:#64748b">Valid + Invalid = Total &middot; In Use + Not In Use = Valid</div>'
    + '</div>');
  h.push('</div>');

  // ===== 2. Global Config =====
  h.push('<div class="section" id="global-config">');
  h.push('<h2>2. Global Config</h2>');
  h.push(`<h3 id="gc-filelist">2.1 File List (${inv.config.valid} valid, ${inv.config.invalid} invalid)</h3>`);
  h.push(fileListTable(inv.config, false));
  if (result.configFindings.size) {
    const totalF = Array.from(result.configFindings.values()).reduce((s, l) => s + l.length, 0);
    h.push(`<h3 id="gc-findings">2.2 Finding Details (${result.configFindings.size} files, ${totalF} findings)</h3>`);
    for (const [rf, findings] of result.configFindings) {
      h.push(`<h3><code>${escapeHtml(path.basename(rf))}</code></h3>`);
      h.push(findingsTable(findings));
    }
  } else {
    h.push('<h3 id="gc-findings">2.2 Finding Details</h3>');
    h.push('<p style="color:#718096">No issues found.</p>');
  }
  h.push('</div>');

  // ===== 3. Scripts =====
  h.push('<div class="section" id="scripts">');
  h.push('<h2>3. Scripts</h2>');
  h.push(`<h3 id="sc-filelist">3.1 File List (${inv.scripts.valid} valid, ${inv.scripts.invalid} invalid)</h3>`);
  h.push(fileListTable(inv.scripts, true));

  // 3.2 Usage
  const usedCount = result.usedScripts.size;
  const unusedCount = result.unusedScripts.length;
  h.push(`<h3 id="sc-usage">3.2 Usage (${usedCount} used, ${unusedCount} not used)</h3>`);
  if (usedCount + unusedCount === 0) {
    h.push('<p style="color:#718096">No script files found.</p>');
  } else {
    h.push('<table><tr><th>Script</th><th>Status</th><th>Referenced By</th></tr>');
    for (const [gf, sources] of result.usedScripts) {
      h.push(`<tr><td><code>${escapeHtml(path.basename(gf))}</code></td><td>Used</td><td>${collapsibleList(sources)}</td></tr>`);
    }
    for (const gf of result.unusedScripts) {
      h.push(`<tr><td><code>${escapeHtml(path.basename(gf))}</code></td>`
        + `<td><span style="color:#d97706">Not Used</span></td><td>Not referenced by any config</td></tr>`);
    }
    h.push('</table>');
  }

  // 3.3 Finding Details (used + unused merged)
  const allScriptFindings = new Map<string, Issue[]>();
  for (const [k, v] of result.scriptFindings) allScriptFindings.set(k, v);
  for (const [k, v] of result.unusedFindings) allScriptFindings.set(k, v);
  if (allScriptFindings.size) {
    const totalF = Array.from(allScriptFindings.values()).reduce((s, l) => s + l.length, 0);
    h.push(`<h3 id="sc-findings">3.3 Finding Details (${allScriptFindings.size} files, ${totalF} findings)</h3>`);
    for (const [gf, findings] of allScriptFindings) {
      h.push(`<h3><code>${escapeHtml(path.basename(gf))}</code></h3>`);
      const refs = result.usedScripts.get(gf);
      if (refs && refs.length) {
        h.push(`<p>Referenced by: ${collapsibleList(refs)}</p>`);
      } else if (result.unusedScripts.includes(gf)) {
        h.push('<p style="color:#d97706">Not referenced by any config file</p>');
      }
      h.push(findingsTable(findings));
    }
  } else {
    h.push('<h3 id="sc-findings">3.3 Finding Details</h3>');
    h.push('<p style="color:#718096">No issues found.</p>');
  }
  h.push('</div>');

  // ===== 4. Routes =====
  h.push('<div class="section" id="routes">');
  h.push('<h2>4. Routes</h2>');
  h.push(`<h3 id="rt-filelist">4.1 File List (${inv.routes.valid} valid, ${inv.routes.invalid} invalid)</h3>`);
  h.push(fileListTable(inv.routes, false));
  if (result.routeFindings.size) {
    const totalF = Array.from(result.routeFindings.values()).reduce((s, l) => s + l.length, 0);
    h.push(`<h3 id="rt-findings">4.2 Finding Details (${result.routeFindings.size} files, ${totalF} findings)</h3>`);
    for (const [rf, findings] of result.routeFindings) {
      h.push(`<h3><code>${escapeHtml(path.basename(rf))}</code></h3>`);
      h.push(findingsTable(findings));
    }
  } else {
    h.push('<h3 id="rt-findings">4.2 Finding Details</h3>');
    h.push('<p style="color:#718096">No issues found.</p>');
  }
  h.push('</div>');

  // ===== 5. Summary =====
  h.push('<div class="section" id="summary">');
  h.push('<h2>5. Summary</h2>');

  // 5.1 Files to Review & Fix
  h.push('<h3 id="files-to-fix">Files to Review &amp; Fix</h3>');
  type FileFix = { name: string; type: string; errors: number; warnings: number };
  const filesToFix: FileFix[] = [];
  const tally = (m: Map<string, Issue[]>, type: string) => {
    for (const [file, findings] of m) {
      const e = findings.filter((f) => f.severity === 'ERROR').length;
      const w = findings.filter((f) => f.severity === 'WARN').length;
      if (e + w > 0) filesToFix.push({ name: path.basename(file), type, errors: e, warnings: w });
    }
  };
  tally(result.scriptFindings, 'Script');
  tally(result.unusedFindings, 'Script (unused)');
  tally(result.configFindings, 'Config');
  tally(result.routeFindings, 'Route');
  if (filesToFix.length) {
    filesToFix.sort((a, b) => (b.errors - a.errors) || (b.warnings - a.warnings));
    h.push('<table><tr><th>File</th><th>Type</th><th class="num">Errors</th><th class="num">Warnings</th></tr>');
    for (const f of filesToFix) {
      h.push(`<tr><td><code>${escapeHtml(f.name)}</code></td><td>${f.type}</td>`
        + `<td class="num">${err(f.errors)}</td><td class="num">${warn(f.warnings)}</td></tr>`);
    }
    h.push('</table>');
  } else {
    h.push('<p style="color:#718096">No files require fixes.</p>');
  }

  // 5.2 Triggered Rules
  if (result.ruleCounts.size) {
    const ruleDescs = new Map<string, string>();
    for (const r of RULES) ruleDescs.set(r.id, r.message);
    for (const [id, desc] of Object.entries(PROCEDURAL_RULE_DESCS)) ruleDescs.set(id, desc);
    h.push(`<h3 id="statistics">Triggered Rules (${result.ruleCounts.size}) <span style="font-size:12px;font-weight:normal;color:#718096">— rules that matched files in this scan</span></h3>`);
    h.push('<table><tr><th style="white-space:nowrap">Rule</th><th class="num">Count</th><th>Description</th></tr>');
    const sortedRules = Array.from(result.ruleCounts.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [rule, count] of sortedRules) {
      const desc = escapeHtml(ruleDescs.get(rule) ?? '');
      h.push(`<tr><td>${rule}</td><td class="num">${count}</td><td>${desc}</td></tr>`);
    }
    h.push('</table>');
  }

  // 5.3 Path References
  if (result.pathRefs.length) {
    h.push(`<h3 id="path-refs">Path References (${result.pathRefs.length} unique paths)</h3>`);
    h.push('<table><tr><th style="white-space:nowrap">Path</th><th class="num">Count</th><th style="word-break:break-all">Referenced In</th></tr>');
    for (const p of result.pathRefs) {
      const files = Array.from(new Set(p.refs.map((r) => r.file))).sort();
      h.push(`<tr><td><code>${escapeHtml(p.path)}</code></td><td class="num">${p.refs.length}</td><td>${collapsibleList(files)}</td></tr>`);
    }
    h.push('</table>');
  }

  // 5.4 Invalid / Garbage Files
  const allInvalid = [
    ...inv.config.invalid_files,
    ...inv.routes.invalid_files,
    ...inv.scripts.invalid_files,
  ];
  if (allInvalid.length) {
    h.push(`<h3 id="garbage">Invalid/Garbage Files (${allInvalid.length})</h3>`);
    h.push('<ul class="invalid-list">');
    for (const f of allInvalid) h.push(`<li><code>${escapeHtml(f)}</code></li>`);
    h.push('</ul>');
  }
  h.push('</div>');

  // ===== Appendix: Scanning Rules =====
  h.push('<div class="section" id="appendix">');
  h.push('<h2>Appendix: Scanning Rules <span style="font-size:12px;font-weight:normal;color:#718096">— all available rules for reference</span></h2>');
  h.push('<table><tr><th style="white-space:nowrap">Rule</th><th style="white-space:nowrap">Severity</th><th>Description</th></tr>');
  const disabled = new Set(result.disabledRules);
  for (const r of RULES) {
    const skipped = disabled.has(r.id);
    const style = skipped ? ' style="opacity:0.5"' : '';
    const tag = skipped ? ' <span style="color:#d97706;font-size:11px">(skipped)</span>' : '';
    h.push(`<tr${style}><td>${r.id}</td><td>${severityBadge(r.severity)}</td><td>${escapeHtml(r.message)}${tag}</td></tr>`);
  }
  for (const [id, desc] of Object.entries(PROCEDURAL_RULE_DESCS).sort(([a], [b]) => a.localeCompare(b))) {
    const sev: Severity = id.endsWith('001') || id.endsWith('002') ? 'ERROR' : 'WARN';
    const skipped = disabled.has(id);
    const style = skipped ? ' style="opacity:0.5"' : '';
    const tag = skipped ? ' <span style="color:#d97706;font-size:11px">(skipped)</span>' : '';
    h.push(`<tr${style}><td>${id}</td><td>${severityBadge(sev)}</td><td>${escapeHtml(desc)}${tag}</td></tr>`);
  }
  h.push('</table>');
  h.push('</div>');

  if (options.withExportButton) {
    h.push(`<script>
      const vscode = acquireVsCodeApi();
      function exportReport() { vscode.postMessage({ type: 'export' }); }
    </script>`);
  }

  h.push('</body></html>');
  return h.join('\n');
}
