import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MqttConfig, MqttGroup } from '../mqttTypes';
import { loadMqttConfigs, loadMqttGroups, saveMqttConfigs, saveMqttGroups } from '../mqttStore';
import { onSdkEvent } from '../sdk';
import {
  buildDefaultOpenGroups,
  createMqttGroup,
  duplicateMqttConfig,
  groupMqttConfigs,
  nextActiveConfigIdAfterDelete,
  ungroupedMqttConfigs,
} from './MqttTool.model';
import type { ConnStatus } from './MqttWorkspace.types';

export function useMqttToolController() {
  const [configs, setConfigs] = useState<MqttConfig[]>([]);
  const [groups, setGroups] = useState<MqttGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ConnStatus>>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [loadedConfigs, loadedGroups] = await Promise.all([loadMqttConfigs(), loadMqttGroups()]);
        if (!alive) return;
        setConfigs(loadedConfigs);
        setGroups(loadedGroups);
        setOpenGroups(buildDefaultOpenGroups(loadedGroups));
        if (loadedConfigs[0]?.id) setActiveId(loadedConfigs[0].id);
      } finally {
        if (alive) setHydrated(true);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const offConnected = onSdkEvent<{ id: string }>('mqtt.connected', ({ id }) => {
      setStatuses((previous) => ({ ...previous, [id]: 'connected' }));
    });
    const offClose = onSdkEvent<{ id: string }>('mqtt.close', ({ id }) => {
      setStatuses((previous) => ({ ...previous, [id]: 'disconnected' }));
    });
    const offReconnect = onSdkEvent<{ id: string }>('mqtt.reconnect', ({ id }) => {
      setStatuses((previous) => ({ ...previous, [id]: 'connecting' }));
    });
    const offError = onSdkEvent<{ id: string }>('mqtt.error', ({ id }) => {
      setStatuses((previous) => ({ ...previous, [id]: 'error' }));
    });
    return () => {
      offConnected();
      offClose();
      offReconnect();
      offError();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveMqttConfigs(configs);
  }, [configs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void saveMqttGroups(groups);
  }, [groups, hydrated]);

  const grouped = useMemo(() => groupMqttConfigs(configs), [configs]);
  const ungrouped = useMemo(() => ungroupedMqttConfigs(configs), [configs]);
  const activeConfig = useMemo(
    () => configs.find((config) => config.id === activeId) ?? null,
    [activeId, configs],
  );
  const editingConfig = useMemo(
    () => (editingId ? configs.find((config) => config.id === editingId) : undefined),
    [configs, editingId],
  );
  const confirmDeleteConfig = useMemo(
    () => (confirmDeleteId ? (configs.find((config) => config.id === confirmDeleteId) ?? null) : null),
    [configs, confirmDeleteId],
  );

  const openAdd = useCallback(() => {
    setEditingId(null);
    setShowEditor(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    setEditingId(id);
    setShowEditor(true);
  }, []);

  const saveConfig = useCallback((config: MqttConfig) => {
    setShowEditor(false);
    setEditingId(null);
    setConfigs((previous) => {
      const index = previous.findIndex((item) => item.id === config.id);
      if (index >= 0) {
        const next = [...previous];
        next[index] = config;
        return next;
      }
      return [config, ...previous];
    });
    setActiveId(config.id);
  }, []);

  const copyConfig = useCallback(
    (id: string) => {
      const source = configs.find((config) => config.id === id);
      if (!source) return;
      const copy = duplicateMqttConfig(source);
      setConfigs((previous) => [copy, ...previous]);
      setActiveId(copy.id);
    },
    [configs],
  );

  const confirmDelete = useCallback(() => {
    if (!confirmDeleteId) return;
    const deletedId = confirmDeleteId;
    setConfirmDeleteId(null);
    setConfigs((previous) => previous.filter((config) => config.id !== deletedId));
    setStatuses((previous) => {
      const next = { ...previous };
      delete next[deletedId];
      return next;
    });
    setActiveId((current) => nextActiveConfigIdAfterDelete(configs, deletedId, current));
  }, [configs, confirmDeleteId]);

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((previous) => ({ ...previous, [groupId]: !previous[groupId] }));
  }, []);

  const addGroup = useCallback(() => {
    setGroupName('');
    setShowGroupDialog(true);
  }, []);

  const confirmAddGroup = useCallback(() => {
    const group = createMqttGroup(groupName);
    if (!group) return;
    setGroups((previous) => [...previous, group]);
    setOpenGroups((previous) => ({ ...previous, [group.id]: true }));
    setShowGroupDialog(false);
  }, [groupName]);

  return {
    configs,
    groups,
    grouped,
    ungrouped,
    activeId,
    activeConfig,
    openGroups,
    statuses,
    showEditor,
    editingConfig,
    showGroupDialog,
    groupName,
    confirmDeleteConfig,
    setActiveId,
    setGroupName,
    setShowEditor,
    setShowGroupDialog,
    setConfirmDeleteId,
    openAdd,
    openEdit,
    saveConfig,
    copyConfig,
    confirmDelete,
    toggleGroup,
    addGroup,
    confirmAddGroup,
  };
}
