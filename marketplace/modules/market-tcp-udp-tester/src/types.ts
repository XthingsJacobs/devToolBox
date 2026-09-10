export type NetProtocol = 'tcp' | 'udp';

export type EndpointConfig = {
  id: string;
  name: string;
  protocol: NetProtocol;
  host: string;
  port: number;
};

export type TcpUdpEvent =
  | { target: 'server' | 'client'; type: 'log'; level: 'info' | 'error'; message: string }
  | { target: 'server' | 'client'; type: 'status'; status: unknown }
  | {
      target: 'server' | 'client';
      type: 'data';
      data: {
        direction: 'recv' | 'sent';
        protocol: NetProtocol;
        bytes: number;
        remote?: string;
        connId?: string;
        text?: string;
        base64?: string;
      };
    };

