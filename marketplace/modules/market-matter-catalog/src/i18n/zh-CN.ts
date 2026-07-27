import type { MessageKey } from './en';

const messages: Record<MessageKey, string> = {
  title: 'Matter 设备目录',
  source: '来源',
  document: '文档',
  version: '版本',
  parsed: '已解析',
  updated: '更新时间',
  refreshing: '刷新中…',
  refresh: '刷新',
  openSpec: '打开规范',
  query: '查询',
  matterVersion: 'Matter 版本',
  versionPlaceholder: '例如 1.2',
  deviceFilter: '设备筛选',
  deviceFilterPlaceholder: '搜索设备类型',
  deviceType: '设备类型',
  matched: '匹配数量',
  openSelectedSection: '打开所选章节',
  clusterRequirements: '集群要求',
  selectDeviceType: '请选择设备类型',
  noClusterTable: '未找到该设备类型的集群表',
  note: '说明：数据从 HTML 规范页面提取，可能滞后于最新 Matter 版本。请使用“打开规范”链接查看权威来源。',
  emptyResponse: '响应为空',
  noDeviceTypesParsed: '未解析到设备类型',
  loadFailedLog: '加载 Matter 设备库失败',
};

export default messages;
