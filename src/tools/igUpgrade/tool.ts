import { Tool } from '../types';
import { openIgUpgradePanel } from './panel';

export const igUpgradeTool: Tool = {
  id: 'igUpgrade',
  label: 'PingGateway Upgrade Analyzer',
  description: 'Compatibility scanner for IG scripts, routes, configs',
  icon: 'shield',
  open: openIgUpgradePanel,
};
