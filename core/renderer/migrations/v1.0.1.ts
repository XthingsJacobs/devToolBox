/**
 * v1.0.0 → v1.0.1 migration example.
 * No migration is required currently; kept as a template.
 */
export const version = '1.0.1';

export function migrate(): void {
  // Example: add a new field to MQTT configs
  // const raw = localStorage.getItem('devtoolbox_mqtt_configs');
  // if (!raw) return;
  // const configs = JSON.parse(raw);
  // const migrated = configs.map((c: any) => ({ ...c, newField: c.newField ?? 'default' }));
  // localStorage.setItem('devtoolbox_mqtt_configs', JSON.stringify(migrated));
}
