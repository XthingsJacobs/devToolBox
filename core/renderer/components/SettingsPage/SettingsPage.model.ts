import type { Locale, StartupStatus } from '@devtoolbox/core';

export type SectionId = 'appearance' | 'language' | 'data' | 'diagnostics' | 'about';

export type SettingsLocaleSetting = 'auto' | Locale;

export const SETTINGS_GROUPS = ['App', 'System', 'About'] as const;

export const THEME_OPTIONS = [
  { id: 'auto' as const, label: 'Auto' },
  { id: 'dark' as const, label: 'Dark' },
  { id: 'light' as const, label: 'Light' },
];

export const LANGUAGE_OPTIONS = [
  {
    id: 'auto' as const,
    label: 'Auto (Follow System)',
    sub: 'Uses your OS language setting',
  },
  { id: 'en' as const, label: 'English', sub: 'English' },
  { id: 'zh-CN' as const, label: 'Simplified Chinese', sub: '简体中文' },
];

export const DEFAULT_STARTUP_STATUS: StartupStatus = {
  safeMode: false,
  reason: null,
  consecutiveFailures: 0,
  failureThreshold: 2,
  startedAt: '',
};

export function describeSettingsSection(id: SectionId): string {
  return {
    appearance: 'Theme and visual preferences',
    language: 'Interface display language and locale',
    data: 'Development marketplace source',
    diagnostics: 'Local runtime events and support bundle',
    about: 'Version info, license and credits',
  }[id];
}

export function formatDiagnosticBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KiB`;
}

export function diagnosticsCopy(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      title: '本地诊断',
      subtitle: '查看脱敏后的运行时事件，或导出支持诊断包',
      retained: '保留事件',
      dropped: '已丢弃',
      localLimit: '本地上限',
      refresh: '刷新',
      export: '导出诊断包',
      exporting: '正在导出…',
      clear: '清空日志',
      privacy:
        '诊断数据只保存在本机。凭据、内容/正文/载荷字段、私钥和用户主目录会在写入前自动脱敏；只有点击导出后才会生成可分享的 JSON 文件。',
      recentTitle: '最近事件',
      recentSubtitle: '最多显示最近 100 条脱敏事件',
      loading: '正在读取诊断事件…',
      empty: '当前没有诊断事件。',
      unavailable: '当前运行环境不支持诊断功能。',
      loadFailed: '无法读取诊断事件。',
      savedTo: '诊断包已保存到：',
      exportCanceled: '已取消导出。',
      exportFailed: '诊断包导出失败。',
      clearConfirm: '确定要清空本机诊断日志吗？此操作无法撤销。',
      cleared: '本机诊断日志已清空。',
      clearFailed: '无法清空诊断日志。',
      recoveryTitle: '启动恢复',
      recoverySubtitle: '在插件隔离模式和正常模式之间安全重启',
      safeMode: '安全模式',
      normalMode: '正常模式',
      safeModeDescription: 'Marketplace 插件在本次会话中已暂停，不会修改它们的永久启用状态。',
      normalModeDescription: '内置工具和已启用的 Marketplace 插件会正常加载。',
      startupFailures: '连续启动失败',
      restartSafe: '以安全模式重启',
      restartNormal: '以正常模式重启',
      restarting: '正在重启…',
      restartFailed: '无法重新启动应用。',
    };
  }

  return {
    title: 'Local diagnostics',
    subtitle: 'Review redacted runtime events or export a support bundle',
    retained: 'Retained events',
    dropped: 'Dropped',
    localLimit: 'Local limit',
    refresh: 'Refresh',
    export: 'Export bundle',
    exporting: 'Exporting…',
    clear: 'Clear log',
    privacy:
      'Diagnostics stay on this device. Credentials, content/body/payload fields, private keys, and the home directory are redacted before storage; a shareable JSON file is created only when you export it.',
    recentTitle: 'Recent events',
    recentSubtitle: 'Shows up to the 100 most recent redacted events',
    loading: 'Loading diagnostic events…',
    empty: 'No diagnostic events have been recorded.',
    unavailable: 'Diagnostics are unavailable in this runtime.',
    loadFailed: 'Unable to load diagnostic events.',
    savedTo: 'Diagnostic bundle saved to:',
    exportCanceled: 'Export canceled.',
    exportFailed: 'Diagnostic bundle export failed.',
    clearConfirm: 'Clear the local diagnostic log? This cannot be undone.',
    cleared: 'Local diagnostic log cleared.',
    clearFailed: 'Unable to clear diagnostic events.',
    recoveryTitle: 'Startup recovery',
    recoverySubtitle: 'Restart safely with or without Marketplace plugin isolation',
    safeMode: 'Safe mode',
    normalMode: 'Normal mode',
    safeModeDescription:
      'Marketplace plugins are paused for this session without changing their enabled state.',
    normalModeDescription: 'Built-in tools and enabled Marketplace plugins load normally.',
    startupFailures: 'Consecutive startup failures',
    restartSafe: 'Restart in safe mode',
    restartNormal: 'Restart normally',
    restarting: 'Restarting…',
    restartFailed: 'Unable to restart the application.',
  };
}

export type DiagnosticsCopy = ReturnType<typeof diagnosticsCopy>;
