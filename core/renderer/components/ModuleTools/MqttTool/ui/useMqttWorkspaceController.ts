import { useCallback, useState } from 'react';
import type { MqttConfig } from '../mqttTypes';
import { mqttMessagesExportFileName, serializeMqttMessages } from './MqttWorkspace.model';
import type { ConnStatus } from './MqttWorkspace.types';
import { useMqttConnectionStatus } from './useMqttConnectionStatus';
import { useMqttMessageBuffer } from './useMqttMessageBuffer';
import { useMqttPublisher } from './useMqttPublisher';
import { useMqttResizablePanes } from './useMqttResizablePanes';
import { useMqttSubscriptions } from './useMqttSubscriptions';

export function useMqttWorkspaceController({
  config,
  externalStatus,
}: {
  config: MqttConfig;
  externalStatus?: ConnStatus;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const panes = useMqttResizablePanes();
  const messageBuffer = useMqttMessageBuffer();
  const subscriptions = useMqttSubscriptions(config.id);
  const connection = useMqttConnectionStatus({
    config,
    externalStatus,
    subsRef: subscriptions.subsRef,
    appendMessage: messageBuffer.appendMessage,
  });
  const publisher = useMqttPublisher({
    configId: config.id,
    status: connection.status,
    appendMessage: messageBuffer.appendMessage,
  });

  const handleSaveMessages = useCallback(() => {
    const text = serializeMqttMessages(messageBuffer.messages);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = mqttMessagesExportFileName(config.name || config.id);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [config.id, config.name, messageBuffer.messages]);

  return {
    showSubDialog: subscriptions.showSubDialog,
    showDeleteConfirm,
    setShowDeleteConfirm,
    headerProps: {
      status: connection.status,
      statusLabel: connection.statusLabel,
      isConnected: connection.isConnected,
      isConnecting: connection.isConnecting,
      busy: connection.busy,
      onConnect: connection.onConnect,
      onDisconnect: connection.onDisconnect,
      onDelete: () => setShowDeleteConfirm(true),
    },
    subscriptionPanelProps: {
      leftWidth: panes.leftWidth,
      ...subscriptions.subscriptionPanelState,
    },
    messageConsoleProps: {
      messages: messageBuffer.messages,
      orderedMessages: messageBuffer.orderedMessages,
      showSearch: messageBuffer.showMsgSearch,
      search: messageBuffer.msgSearch,
      searchMatches: messageBuffer.searchMatches,
      searchMatchIdx: messageBuffer.searchMatchIdx,
      msgListRef: messageBuffer.msgListRef,
      msgSearchRef: messageBuffer.msgSearchRef,
      onSearchChange: messageBuffer.setMsgSearch,
      onSearchPrev: messageBuffer.handleSearchPrev,
      onSearchNext: messageBuffer.handleSearchNext,
      onSearchClose: messageBuffer.closeMessageSearch,
      onSaveMessages: handleSaveMessages,
      onClearMessages: messageBuffer.clearMessages,
    },
    publishPanelProps: {
      height: panes.pubHeight,
      ...publisher,
    },
    subscriptionDialogProps: subscriptions.subscriptionDialogProps,
    rightPanelProps: {
      onKeyDown: messageBuffer.handleWorkspaceKeyDown,
    },
    onPublishResizeStart: panes.handlePublishResizeStart,
    onSidebarResizeStart: panes.handleSidebarResizeStart,
  };
}
