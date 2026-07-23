import { useMemo } from 'react';
import { fileService, networkService } from '../../../services';
import styles from './ServerPanel.module.css';
import { ServerConfigBar, ServerErrorBar, ServerTlsBar } from './ServerConfigBar';
import { ServerLogs } from './ServerLogs';
import { ServerSendBar } from './ServerSendBar';
import { ServerStressBar } from './ServerStressBar';
import type { WsServerBridge } from './ServerPanel.types';
import { useServerPanelController } from './useServerPanelController';

function createElectronWsBridge(): WsServerBridge {
  return {
    isAvailable: () => networkService.isAvailable(),
    status: () => networkService.wsServerStatus() ?? Promise.resolve(undefined),
    start: (params) => networkService.wsServerStart(params) ?? Promise.resolve(undefined),
    stop: () => networkService.wsServerStop() ?? Promise.resolve(undefined),
    send: (params) => networkService.wsServerSend(params) ?? Promise.resolve(undefined),
    kick: (params) => networkService.wsServerKick(params) ?? Promise.resolve(undefined),
    stressStart: (params) => networkService.wsServerStressStart(params) ?? Promise.resolve(undefined),
    stressStop: () => networkService.wsServerStressStop() ?? Promise.resolve(undefined),
    openPem: async () => {
      const picked = await fileService.openFile([{ name: 'PEM', extensions: ['pem', 'crt', 'key'] }], 'utf8');
      if (!picked?.content) throw new Error('No file selected');
      return picked.content;
    },
    onEvent: (callback) => networkService.onWsServerEvent(callback),
    offEvent: (handler) => networkService.offWsServerEvent(handler),
  };
}

export default function ServerPanel() {
  const bridge = useMemo(() => createElectronWsBridge(), []);
  const controller = useServerPanelController(bridge);

  return (
    <div className={styles.container}>
      <ServerConfigBar
        form={controller.form}
        status={controller.status}
        clientsCount={controller.clients.length}
        running={controller.running}
        startDisabled={controller.startDisabled}
        onFieldChange={controller.setFormField}
        onStart={controller.start}
        onStop={controller.stop}
      />

      {controller.form.tls && (
        <ServerTlsBar
          certLoaded={Boolean(controller.form.certPem)}
          keyLoaded={Boolean(controller.form.keyPem)}
          running={controller.running}
          onLoadCert={controller.loadCert}
          onLoadKey={controller.loadKey}
        />
      )}

      <ServerErrorBar error={controller.error} />
      <ServerLogs logs={controller.logs} />
      <ServerSendBar
        clients={controller.clients}
        running={controller.running}
        selectedClientId={controller.selectedClientId}
        broadcastText={controller.broadcastText}
        onSelectedClientChange={controller.setSelectedClientId}
        onBroadcastTextChange={controller.setBroadcastText}
        onSend={controller.send}
        onKick={controller.kick}
        onClear={() => controller.setLogs([])}
      />
      <ServerStressBar
        running={controller.running}
        stressEnabled={controller.stressEnabled}
        intervalMs={controller.stressIntervalMs}
        payloadBytes={controller.stressPayloadBytes}
        onIntervalChange={controller.setStressIntervalMs}
        onPayloadBytesChange={controller.setStressPayloadBytes}
        onToggleStress={controller.toggleStress}
      />
    </div>
  );
}
