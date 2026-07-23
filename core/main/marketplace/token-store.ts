import crypto from 'node:crypto';

export class PluginTokenStore {
  private readonly values = new Map<string, Map<string, string>>();

  issue(pluginId: string, value: string): string {
    const token = crypto.randomUUID();
    const pluginValues = this.values.get(pluginId) ?? new Map<string, string>();
    pluginValues.set(token, value);
    this.values.set(pluginId, pluginValues);
    return token;
  }

  resolve(pluginId: string, token: string): string | undefined {
    return this.values.get(pluginId)?.get(token);
  }

  clear(pluginId: string): void {
    this.values.delete(pluginId);
  }
}
