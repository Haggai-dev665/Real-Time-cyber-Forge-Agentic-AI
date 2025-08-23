import React, { createContext, useContext, useEffect, useState } from 'react';

const DesktopConnectionContext = createContext();

export const useDesktopConnection = () => {
  const context = useContext(DesktopConnectionContext);
  if (!context) {
    throw new Error('useDesktopConnection must be used within a DesktopConnectionProvider');
  }
  return context;
};

export const DesktopConnectionProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [desktopData, setDesktopData] = useState(null);
  const [ws, setWs] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connectToDesktop = (desktopUrl = 'ws://192.168.1.100:8000') => {
    try {
      const websocket = new WebSocket(`${desktopUrl}/mobile`);
      
      websocket.onopen = () => {
        console.log('Connected to desktop application');
        setIsConnected(true);
        setReconnectAttempts(0);
        setWs(websocket);
        
        // Send mobile app identification
        websocket.send(JSON.stringify({
          type: 'mobile_connected',
          device_info: {
            platform: 'mobile',
            timestamp: new Date().toISOString()
          }
        }));
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleDesktopMessage(data);
        } catch (error) {
          console.error('Failed to parse desktop message:', error);
        }
      };

      websocket.onclose = () => {
        console.log('Disconnected from desktop application');
        setIsConnected(false);
        setWs(null);
        
        // Attempt to reconnect
        if (reconnectAttempts < 5) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectToDesktop(desktopUrl);
          }, 5000 * (reconnectAttempts + 1));
        }
      };

      websocket.onerror = (error) => {
        console.error('Desktop connection error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect to desktop:', error);
      setIsConnected(false);
    }
  };

  const handleDesktopMessage = (message) => {
    switch (message.type) {
      case 'dashboard_update':
        setDesktopData(prevData => ({
          ...prevData,
          dashboard: message.data
        }));
        break;
      
      case 'threat_alert':
        setDesktopData(prevData => ({
          ...prevData,
          threats: [...(prevData?.threats || []), message.data]
        }));
        break;
      
      case 'analysis_result':
        setDesktopData(prevData => ({
          ...prevData,
          analysis: message.data
        }));
        break;
      
      case 'ai_insight':
        setDesktopData(prevData => ({
          ...prevData,
          insights: [...(prevData?.insights || []), message.data]
        }));
        break;
      
      default:
        console.log('Unknown message type from desktop:', message.type);
    }
  };

  const sendToDesktop = (data) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  const requestDesktopData = (dataType) => {
    return sendToDesktop({
      type: 'request_data',
      data_type: dataType
    });
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
    }
    setIsConnected(false);
    setWs(null);
    setDesktopData(null);
  };

  const value = {
    isConnected,
    desktopData,
    connectToDesktop,
    sendToDesktop,
    requestDesktopData,
    disconnect,
    reconnectAttempts
  };

  return (
    <DesktopConnectionContext.Provider value={value}>
      {children}
    </DesktopConnectionContext.Provider>
  );
};