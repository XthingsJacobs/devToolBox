import styles from './MqttTool.module.css';
import MqttConfigDialog from './MqttConfigDialog';
import MqttConnectionDeleteDialog from './MqttConnectionDeleteDialog';
import MqttGroupDialog from './MqttGroupDialog';
import MqttToolSidebar from './MqttToolSidebar';
import MqttWorkspace from './MqttWorkspace';
import { t } from './i18n';
import { useMqttToolController } from './useMqttToolController';

export default function MqttTool() {
  const controller = useMqttToolController();

  return (
    <div className={styles.appShell}>
      <MqttToolSidebar
        ungrouped={controller.ungrouped}
        groups={controller.groups}
        grouped={controller.grouped}
        activeId={controller.activeId}
        openGroups={controller.openGroups}
        statuses={controller.statuses}
        onAddGroup={controller.addGroup}
        onAddConfig={controller.openAdd}
        onSelectConfig={controller.setActiveId}
        onToggleGroup={controller.toggleGroup}
      />

      <div className={styles.content}>
        {!controller.activeConfig && <div className={styles.emptyState}>{t('noSubscriptions')}</div>}
        {controller.activeConfig && (
          <MqttWorkspace
            key={controller.activeConfig.id}
            config={controller.activeConfig}
            status={controller.statuses[controller.activeConfig.id] ?? 'disconnected'}
            onEdit={controller.openEdit}
            onCopy={controller.copyConfig}
            onDelete={controller.setConfirmDeleteId}
          />
        )}
      </div>

      {controller.showEditor && (
        <MqttConfigDialog
          config={controller.editingConfig}
          groups={controller.groups}
          onSave={controller.saveConfig}
          onClose={() => controller.setShowEditor(false)}
        />
      )}

      {controller.showGroupDialog && (
        <MqttGroupDialog
          groupName={controller.groupName}
          onGroupNameChange={controller.setGroupName}
          onCancel={() => controller.setShowGroupDialog(false)}
          onConfirm={controller.confirmAddGroup}
        />
      )}

      {controller.confirmDeleteConfig && (
        <MqttConnectionDeleteDialog
          connectionName={controller.confirmDeleteConfig.name}
          onCancel={() => controller.setConfirmDeleteId(null)}
          onConfirm={controller.confirmDelete}
        />
      )}
    </div>
  );
}
