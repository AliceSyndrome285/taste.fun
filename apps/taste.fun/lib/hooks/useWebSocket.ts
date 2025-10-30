/**
 * WebSocket Hook for Real-Time Updates
 * Connects to backend WebSocket server and handles real-time events
 */

import { useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';

export enum WSMessageType {
  IdeaNew = 'idea:new',
  IdeaUpdateStatus = 'idea:update:status',
  IdeaUpdateStats = 'idea:update:stats',
  VoteNew = 'vote:new',
  StatsGlobal = 'stats:global',
}

export interface WSMessage {
  type: WSMessageType;
  data: any;
}

export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  send: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Custom hook for WebSocket connection
 * 
 * @example
 * ```tsx
 * const { isConnected, lastMessage } = useWebSocket({
 *   autoConnect: true,
 * });
 * 
 * useEffect(() => {
 *   if (lastMessage?.type === WSMessageType.VoteNew) {
 *     console.log('New vote:', lastMessage.data);
 *   }
 * }, [lastMessage]);
 * ```
 */
export function useWebSocket(
  onMessage?: (message: WSMessage) => void,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    url = WS_URL,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection if enabled
        if (
          shouldReconnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  };

  const send = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isConnected,
    lastMessage,
    send,
    connect,
    disconnect,
  };
}

/**
 * Hook for listening to specific WebSocket message types
 * 
 * @example
 * ```tsx
 * useWebSocketListener(WSMessageType.VoteNew, (data) => {
 *   console.log('New vote:', data);
 *   // Update local state
 * });
 * ```
 */
export function useWebSocketListener(
  messageType: WSMessageType,
  callback: (data: any) => void,
  options?: UseWebSocketOptions
) {
  useWebSocket((message) => {
    if (message.type === messageType) {
      callback(message.data);
    }
  }, options);
}

export default useWebSocket;
