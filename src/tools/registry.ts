import { Tool } from './types';
import { igUpgradeTool } from './igUpgrade/tool';

export const TOOLS: Tool[] = [igUpgradeTool];

export function findTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}
