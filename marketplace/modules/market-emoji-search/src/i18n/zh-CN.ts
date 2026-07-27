import type { MessageKey } from './en';

const messages: Record<MessageKey, string> = {
  title: 'Emoji 图标查询',
  subtitle: '按分类筛选，支持标签/名称/短码搜索，点击 Emoji 复制',
  allGroups: '全部分类',
  allSubgroups: '全部子分类',
  searchPlaceholder: '搜索标签 / 名称 / shortcodes（支持模糊）',
  loading: '加载中…',
  shown: '已显示',
  loadMore: '加载更多',
  copied: '已复制',
  copyFailed: '复制失败',
  sizeSm: '小',
  sizeMd: '中',
  sizeLg: '大',
  sizeXl: '超大',
};

export default messages;
