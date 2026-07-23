import type { MqttConfig } from '../mqttTypes';
import styles from './MqttWorkspace.module.css';
import MqttDeleteConfirmDialog from './MqttDeleteConfirmDialog';
import MqttMessageConsole from './MqttMessageConsole';
import MqttPublishPanel from './MqttPublishPanel';
import MqttSubscriptionDialog from './MqttSubscriptionDialog';
import MqttSubscriptionPanel from './MqttSubscriptionPanel';
import { MqttWorkspaceHeader } from './MqttWorkspaceHeader';
import type { ConnStatus } from './MqttWorkspace.types';
import { useMqttWorkspaceController } from './useMqttWorkspaceController';

interface Props {
  config: MqttConfig;
  status?: ConnStatus;
  onEdit?: (id: string) => void;
  onCopy?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function MqttWorkspace({ config, status: externalStatus, onEdit, onCopy, onDelete }: Props) {
  const controller = useMqttWorkspaceController({ config, externalStatus });

  return (
    <div className={styles.container}>
      <MqttWorkspaceHeader
        config={config}
        onEdit={onEdit}
        onCopy={onCopy}
        {...controller.headerProps}
        onDelete={onDelete ? controller.headerProps.onDelete : undefined}
      />

      <div className={styles.main}>
        <MqttSubscriptionPanel {...controller.subscriptionPanelProps} />
        <div className={styles.hResizeHandle} onMouseDown={controller.onSidebarResizeStart} />
        <div className={styles.rightPanel} tabIndex={-1} {...controller.rightPanelProps}>
          <MqttMessageConsole {...controller.messageConsoleProps} />
          <div className={styles.resizeHandle} onMouseDown={controller.onPublishResizeStart} />
          <MqttPublishPanel {...controller.publishPanelProps} />
        </div>
      </div>

      {controller.showSubDialog && <MqttSubscriptionDialog {...controller.subscriptionDialogProps} />}

      {controller.showDeleteConfirm && (
        <MqttDeleteConfirmDialog
          connectionName={config.name}
          onCancel={() => controller.setShowDeleteConfirm(false)}
          onConfirm={() => {
            controller.setShowDeleteConfirm(false);
            onDelete?.(config.id);
          }}
        />
      )}
    </div>
  );
}
