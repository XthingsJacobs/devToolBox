import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSubs, saveSubs } from '../mqttStore';
import { mqttSubscribe, mqttUnsubscribe } from '../sdk';
import { filterTopicTemplates } from './MqttWorkspace.model';
import type { MqttSubscription } from './MqttWorkspace.types';
import type { HoverSubscription } from './MqttSubscriptionPanel';

export function useMqttSubscriptions(configId: string) {
  const [subs, setSubs] = useState<MqttSubscription[]>([]);
  const [subTopic, setSubTopic] = useState('');
  const [subQos, setSubQos] = useState<MqttSubscription['qos']>(0);
  const [showSubTopicDropdown, setShowSubTopicDropdown] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [hoverSub, setHoverSub] = useState<HoverSubscription>(null);
  const subTopicInputRef = useRef<HTMLInputElement>(null);
  const subsRef = useRef(subs);
  subsRef.current = subs;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const loaded = await loadSubs(configId);
      if (!alive) return;
      setSubs(loaded);
    })();
    return () => {
      alive = false;
    };
  }, [configId]);

  useEffect(() => {
    void saveSubs(configId, subs);
  }, [configId, subs]);

  const filteredTemplates = useMemo(() => filterTopicTemplates(subTopic), [subTopic]);

  const handleSubscribe = useCallback(async () => {
    const topic = subTopic.trim();
    if (!topic) return;
    if (subs.some((subscription) => subscription.topic === topic)) return;
    setSubs((previous) => [...previous, { topic, qos: subQos, enabled: true }]);
    await mqttSubscribe(configId, topic, subQos);
    setSubTopic('');
  }, [configId, subQos, subTopic, subs]);

  const handleUnsubscribe = useCallback(
    async (topic: string) => {
      setSubs((previous) => previous.filter((subscription) => subscription.topic !== topic));
      await mqttUnsubscribe(configId, topic);
    },
    [configId],
  );

  const handleToggleSub = useCallback(
    async (topic: string, enabled: boolean) => {
      setSubs((previous) =>
        previous.map((subscription) =>
          subscription.topic === topic ? { ...subscription, enabled } : subscription,
        ),
      );
      if (enabled) {
        const subscription = subs.find((item) => item.topic === topic);
        await mqttSubscribe(configId, topic, subscription?.qos ?? 0);
      } else {
        await mqttUnsubscribe(configId, topic);
      }
    },
    [configId, subs],
  );

  return {
    subs,
    subsRef,
    showSubDialog,
    setShowSubDialog,
    subscriptionPanelState: {
      subscriptions: subs,
      hoverSub,
      onHoverSubChange: setHoverSub,
      onAddSubscription: () => setShowSubDialog(true),
      onToggleSubscription: (topic: string, enabled: boolean) => void handleToggleSub(topic, enabled),
      onUnsubscribe: (topic: string) => void handleUnsubscribe(topic),
    },
    subscriptionDialogProps: {
      topic: subTopic,
      qos: subQos,
      showTopicDropdown: showSubTopicDropdown,
      filteredTemplates,
      inputRef: subTopicInputRef,
      onTopicChange: setSubTopic,
      onQosChange: setSubQos,
      onDropdownChange: setShowSubTopicDropdown,
      onSubscribe: () => void handleSubscribe(),
      onClose: () => setShowSubDialog(false),
    },
  };
}
