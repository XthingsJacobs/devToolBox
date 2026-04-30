export const STORAGE_KEY = 'devtoolbox:dashboard:worldClocks:v1';

export const POPULAR_ZONES: { tz: string; city: string }[] = [
  { tz: 'Asia/Shanghai', city: 'Shanghai' },
  { tz: 'Europe/London', city: 'London' },
  { tz: 'America/New_York', city: 'New York' },
  { tz: 'Asia/Tokyo', city: 'Tokyo' },
  { tz: 'Australia/Sydney', city: 'Sydney' },
];

export const PRESET_ZONES: { tz: string; label: string }[] = [
  { tz: 'Asia/Shanghai', label: 'Asia/Shanghai (Shanghai)' },
  { tz: 'Asia/Tokyo', label: 'Asia/Tokyo (Tokyo)' },
  { tz: 'Asia/Singapore', label: 'Asia/Singapore (Singapore)' },
  { tz: 'Asia/Dubai', label: 'Asia/Dubai (Dubai)' },
  { tz: 'Europe/London', label: 'Europe/London (London)' },
  { tz: 'Europe/Paris', label: 'Europe/Paris (Paris)' },
  { tz: 'America/New_York', label: 'America/New_York (New York)' },
  { tz: 'America/Los_Angeles', label: 'America/Los_Angeles (Los Angeles)' },
  { tz: 'America/Chicago', label: 'America/Chicago (Chicago)' },
  { tz: 'Australia/Sydney', label: 'Australia/Sydney (Sydney)' },
  { tz: 'Pacific/Auckland', label: 'Pacific/Auckland (Auckland)' },
  { tz: 'UTC', label: 'UTC' },
];

export const MAX_ZONES = 30;

