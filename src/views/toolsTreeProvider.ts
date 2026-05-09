import * as vscode from 'vscode';
import { Tool } from '../tools/types';
import { TOOLS } from '../tools/registry';

export class ToolsTreeProvider implements vscode.TreeDataProvider<Tool> {
  getTreeItem(tool: Tool): vscode.TreeItem {
    const item = new vscode.TreeItem(tool.label);
    item.description = tool.description;
    item.iconPath = new vscode.ThemeIcon(tool.icon);
    item.tooltip = `${tool.label} — ${tool.description}`;
    item.command = {
      command: 'iamToolkit.openTool',
      title: 'Open',
      arguments: [tool.id],
    };
    return item;
  }

  getChildren(): Tool[] {
    return TOOLS;
  }
}
