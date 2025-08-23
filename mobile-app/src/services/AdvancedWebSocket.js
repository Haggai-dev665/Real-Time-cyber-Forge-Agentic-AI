/**
 * Advanced WebSocket Manager for Mobile App
 * Enhanced real-time communication with advanced features
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const AdvancedWebSocketContext = createContext();

export const useAdvancedWebSocket = () => {
  const context = useContext(AdvancedWebSocketContext);
  if (!context) {
    throw new Error('useAdvancedWebSocket must be used within AdvancedWebSocketProvider');
  }
  return context;
};

export const AdvancedWebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [realTimeData, setRealTimeData] = useState({});
  const [messageQueue, setMessageQueue] = useState([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latency, setLatency] = useState(0);
  
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      cleanupConnection();
    };
  }, []);

  const connectWebSocket = (url = 'ws://localhost:8000') => {
    try {
      setConnectionStatus('connecting');
      
      const websocket = new WebSocket(`${url}/mobile`);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('🔗 Advanced WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        
        // Send initial handshake
        sendMessage({
          type: 'mobile_handshake',
          timestamp: new Date().toISOString(),
          device_info: {
            platform: 'mobile',
            version: '2.0.0',
            capabilities: [
              'real_time_monitoring',
              'push_notifications',
              'offline_mode',
              'data_visualization'
            ]
          }
        });

        // Start heartbeat
        startHeartbeat();
        
        // Process queued messages
        processMessageQueue();
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        stopHeartbeat();
        
        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect();
        } else {
          setConnectionStatus('failed');
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const scheduleReconnect = () => {
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
    setConnectionStatus('reconnecting');
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectWebSocket();
    }, delay);
  };

  const handleIncomingMessage = (message) => {
    const { type, data, timestamp } = message;
    
    // Calculate latency for ping messages
    if (type === 'pong') {
      const now = Date.now();
      const pingTime = parseInt(data.ping_timestamp);
      setLatency(now - pingTime);
      return;
    }

    // Handle different message types
    switch (type) {
      case 'real_time_data':
        setRealTimeData(prev => ({ ...prev, ...data }));
        break;
        
      case 'threat_alert':
        handleThreatAlert(data);
        break;
        
      case 'ml_update':
        handleMLUpdate(data);
        break;
        
      case 'system_status':
        handleSystemStatus(data);
        break;
        
      case 'analytics_data':
        handleAnalyticsData(data);
        break;
        
      case 'notification':
        handleNotification(data);
        break;
        
      default:
        console.log('Received unknown message type:', type);
    }
  };

  const handleThreatAlert = (alertData) => {
    console.log('🚨 Threat Alert received:', alertData);
    
    // Store in real-time data
    setRealTimeData(prev => ({
      ...prev,
      threats: {
        ...prev.threats,
        latest: alertData,
        count: (prev.threats?.count || 0) + 1
      }
    }));

    // Show push notification if app is in background
    showPushNotification({
      title: `${alertData.severity.toUpperCase()} Threat Detected`,
      body: alertData.description,
      data: { type: 'threat', ...alertData }
    });
  };

  const handleMLUpdate = (mlData) => {
    console.log('🤖 ML Update received:', mlData);
    
    setRealTimeData(prev => ({
      ...prev,
      ml: {
        ...prev.ml,
        ...mlData,
        last_updated: new Date().toISOString()
      }
    }));
  };

  const handleSystemStatus = (statusData) => {
    setRealTimeData(prev => ({
      ...prev,
      system: {
        ...prev.system,
        ...statusData
      }
    }));
  };

  const handleAnalyticsData = (analyticsData) => {
    setRealTimeData(prev => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        ...analyticsData
      }
    }));
  };

  const handleNotification = (notificationData) => {
    showPushNotification({
      title: notificationData.title,
      body: notificationData.message,
      data: notificationData
    });
  };

  const showPushNotification = async (notification) => {
    // This would integrate with React Native's push notification system
    console.log('📱 Push Notification:', notification);
    
    // For now, just add to real-time data
    setRealTimeData(prev => ({
      ...prev,
      notifications: [
        notification,
        ...(prev.notifications || []).slice(0, 9) // Keep last 10
      ]
    }));
  };

  const sendMessage = (message) => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const messageWithId = {
          ...message,
          id: generateMessageId(),
          timestamp: new Date().toISOString()
        };
        
        wsRef.current.send(JSON.stringify(messageWithId));
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        return false;
      }
    } else {
      // Queue message for later
      console.log('📬 Queueing message for later delivery');
      setMessageQueue(prev => [...prev, message]);
      return false;
    }
  };

  const processMessageQueue = () => {
    if (messageQueue.length > 0) {
      console.log(`📮 Processing ${messageQueue.length} queued messages`);
      
      messageQueue.forEach(message => {
        sendMessage(message);
      });
      
      setMessageQueue([]);
    }
  };

  const startHeartbeat = () => {
    heartbeatRef.current = setInterval(() => {
      if (isConnected) {
        sendMessage({
          type: 'ping',
          ping_timestamp: Date.now().toString()
        });
      }
    }, 30000); // Every 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const cleanupConnection = () => {
    stopHeartbeat();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Advanced messaging methods
  const requestData = (dataType, parameters = {}) => {
    return sendMessage({
      type: 'request_data',
      data_type: dataType,
      parameters
    });
  };

  const subscribeToUpdates = (channels) => {
    return sendMessage({
      type: 'subscribe',
      channels: Array.isArray(channels) ? channels : [channels]
    });
  };

  const unsubscribeFromUpdates = (channels) => {
    return sendMessage({
      type: 'unsubscribe',
      channels: Array.isArray(channels) ? channels : [channels]
    });
  };

  const triggerAction = (action, payload = {}) => {
    return sendMessage({
      type: 'action',
      action,
      payload
    });
  };

  const sendAnalyticsEvent = (event, properties = {}) => {
    return sendMessage({
      type: 'analytics_event',
      event,
      properties,
      user_agent: 'mobile-app'
    });
  };

  const value = {
    // Connection state
    isConnected,
    connectionStatus,
    reconnectAttempts,
    latency,
    
    // Data
    realTimeData,
    messageQueue: messageQueue.length,
    
    // Basic methods
    sendMessage,
    connectWebSocket,
    
    // Advanced methods
    requestData,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    triggerAction,
    sendAnalyticsEvent,
    
    // Utility methods
    cleanupConnection,
  };

  return (
    <AdvancedWebSocketContext.Provider value={value}>
      {children}
    </AdvancedWebSocketContext.Provider>
  );
};

export default AdvancedWebSocketProvider;