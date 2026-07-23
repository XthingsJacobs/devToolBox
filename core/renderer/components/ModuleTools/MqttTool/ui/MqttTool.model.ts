import type { MqttConfig, MqttGroup } from '../mqttTypes';
import { getDefaultMqttConfig } from '../mqttTypes';

export function buildDefaultOpenGroups(groups: MqttGroup[]): Record<string, boolean> {
  return Object.fromEntries(groups.map((group) => [group.id, true]));
}

export function groupMqttConfigs(configs: MqttConfig[]): Record<string, MqttConfig[]> {
  const grouped: Record<string, MqttConfig[]> = {};
  configs.forEach((config) => {
    const groupId = config.groupId;
    if (!groupId) return;
    grouped[groupId] ||= [];
    grouped[groupId].push(config);
  });
  return grouped;
}

export function ungroupedMqttConfigs(configs: MqttConfig[]): MqttConfig[] {
  return configs.filter((config) => !config.groupId);
}

export function duplicateMqttConfig(source: MqttConfig, defaultConfig = getDefaultMqttConfig()): MqttConfig {
  return {
    ...source,
    id: defaultConfig.id,
    name: `${source.name} (copy)`,
    clientId: defaultConfig.clientId,
  };
}

export function createMqttGroup(name: string, now = Date.now, random = Math.random): MqttGroup | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return {
    id: `g_${now()}_${random().toString(36).slice(2, 6)}`,
    name: trimmed,
  };
}

export function nextActiveConfigIdAfterDelete(
  configs: MqttConfig[],
  deletedId: string,
  activeId: string | null,
): string | null {
  if (activeId !== deletedId) return activeId;
  return configs.find((config) => config.id !== deletedId)?.id ?? null;
}
