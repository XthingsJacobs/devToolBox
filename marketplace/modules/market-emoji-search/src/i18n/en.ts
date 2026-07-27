const messages = {
  title: 'Emoji Search',
  subtitle: 'Filter by category, search by tags/name/shortcodes, click to copy',
  allGroups: 'All categories',
  allSubgroups: 'All subcategories',
  searchPlaceholder: 'Search tags / name / shortcodes (fuzzy)',
  loading: 'Loading…',
  shown: 'Shown',
  loadMore: 'Load more',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  sizeSm: 'S',
  sizeMd: 'M',
  sizeLg: 'L',
  sizeXl: 'XL',
} as const;

export type MessageKey = keyof typeof messages;

export default messages;
