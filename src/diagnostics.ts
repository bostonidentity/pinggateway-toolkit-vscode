import * as vscode from 'vscode';
import { Issue, Severity } from './analyzer/types';

let collection: vscode.DiagnosticCollection | undefined;

function severityToVscode(s: Severity): vscode.DiagnosticSeverity {
  switch (s) {
    case 'ERROR':
      return vscode.DiagnosticSeverity.Error;
    case 'WARN':
      return vscode.DiagnosticSeverity.Warning;
    case 'INFO':
      return vscode.DiagnosticSeverity.Information;
  }
}

export function publishDiagnostics(context: vscode.ExtensionContext, issues: Issue[]): void {
  if (!collection) {
    collection = vscode.languages.createDiagnosticCollection('iamToolkit.igUpgrade');
    context.subscriptions.push(collection);
  }
  collection.clear();

  const byFile = new Map<string, Issue[]>();
  for (const issue of issues) {
    const arr = byFile.get(issue.filePath) ?? [];
    arr.push(issue);
    byFile.set(issue.filePath, arr);
  }

  for (const [filePath, fileIssues] of byFile) {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = fileIssues.map((issue) => {
      const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, Number.MAX_SAFE_INTEGER);
      const diag = new vscode.Diagnostic(
        range,
        `${issue.message}\nFix: ${issue.fix}`,
        severityToVscode(issue.severity),
      );
      diag.code = issue.ruleId;
      diag.source = 'PingGateway Toolkit';
      return diag;
    });
    collection.set(uri, diagnostics);
  }
}
