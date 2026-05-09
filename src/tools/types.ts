import * as vscode from 'vscode';

export interface Tool {
  id: string;
  label: string;
  description: string;
  icon: string;
  open(context: vscode.ExtensionContext, prefilledFolder?: vscode.Uri): Promise<void>;
}
