import { describe, expect, it } from 'vitest';
import { backupProtectionModes } from '../protection';

describe('backup protection plan', () => {
  it('does not imply encryption when no protection was selected', () => {
    expect(backupProtectionModes({ bindToDevice: false })).toEqual([]);
  });

  it('uses only explicit device and password protection', () => {
    expect(backupProtectionModes({ bindToDevice: true })).toEqual(['device']);
    expect(backupProtectionModes({ bindToDevice: false, password: 'password' })).toEqual(['password']);
    expect(backupProtectionModes({ bindToDevice: true, password: 'password' })).toEqual([
      'device',
      'password',
    ]);
  });
});
