const messages = {
  title: 'Matter Catalog',
  source: 'Source',
  document: 'Document',
  version: 'Version',
  parsed: 'Parsed',
  updated: 'updated',
  refreshing: 'Refreshing…',
  refresh: 'Refresh',
  openSpec: 'Open Spec',
  query: 'Query',
  matterVersion: 'Matter version',
  versionPlaceholder: 'e.g. 1.2',
  deviceFilter: 'Device filter',
  deviceFilterPlaceholder: 'Search device type',
  deviceType: 'Device type',
  matched: 'Matched',
  openSelectedSection: 'Open selected section',
  clusterRequirements: 'Cluster requirements',
  selectDeviceType: 'Select a device type',
  noClusterTable: 'No cluster table found for this device type',
  note: 'Notes: Data is extracted from the HTML spec page and may lag behind the newest Matter releases. Use the “Open Spec” link for the authoritative source.',
  emptyResponse: 'Empty response',
  noDeviceTypesParsed: 'No device types parsed',
  loadFailedLog: 'Failed to load Matter Device Library',
} as const;

export type MessageKey = keyof typeof messages;

export default messages;
