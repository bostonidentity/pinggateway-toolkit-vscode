import * as vscode from 'vscode';
import { ToolsTreeProvider } from './views/toolsTreeProvider';
import { findTool } from './tools/registry';
import { igUpgradeTool } from './tools/igUpgrade/tool';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('iamToolkit.tools', new ToolsTreeProvider()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('iamToolkit.openTool', (toolId: string) => {
      const tool = findTool(toolId);
      if (tool) void tool.open(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'iamToolkit.analyzeIgUpgrade',
      (folderUri?: vscode.Uri) => igUpgradeTool.open(context, folderUri),
    ),
  );
}

export function deactivate(): void {}
