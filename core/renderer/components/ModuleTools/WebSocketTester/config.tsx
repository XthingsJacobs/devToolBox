import type { ModuleConfig } from '../../../types';
import WebSocketTester from './index';
import { VscDebugDisconnect } from 'react-icons/vsc';

const config: ModuleConfig = {
  id: 'core-websocket-tester',
  name: 'WebSocket Tester',
  description: 'Connect to a WebSocket and send/receive messages',
  categoryId: 'network-tools',
  component: WebSocketTester,
  icon: <VscDebugDisconnect />,
};

export default config;
