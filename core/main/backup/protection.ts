export type BackupProtectionMode = 'device' | 'password';

export function backupProtectionModes(options: {
  bindToDevice: boolean;
  password?: string;
}): BackupProtectionMode[] {
  const modes: BackupProtectionMode[] = [];
  if (options.bindToDevice) modes.push('device');
  if (options.password) modes.push('password');
  return modes;
}
