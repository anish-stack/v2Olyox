// BackgroundTaskDebugScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import useBackgroundTask from '../hooks/New Hookes/useBackgroundTask';

const BackgroundTaskDebugScreen = () => {
  const {
    isBackgroundTaskActive,
    appState,
    backgroundTaskStatus,
    lastBackgroundExecution,
    notificationCount,
    initializeBackgroundTasks,
    stopBackgroundTasks,
    checkBackgroundFetchStatus,
    startTestIntervalNotifications,
    stopTestIntervalNotifications,
  } = useBackgroundTask();

  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(null);
  const [registeredTasks, setRegisteredTasks] = useState([]);

  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{
      id: Date.now(),
      message,
      type,
      timestamp
    }, ...prev.slice(0, 49)]); // Keep only last 50 logs
  };

  // Check notification permissions
  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationPermission(status);
      addLog(`Notification permission: ${status}`, status === 'granted' ? 'success' : 'warning');
      return status === 'granted';
    } catch (error) {
      addLog(`Error checking notifications: ${error.message}`, 'error');
      return false;
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status);
      addLog(`Notification permission requested: ${status}`, status === 'granted' ? 'success' : 'error');
      return status === 'granted';
    } catch (error) {
      addLog(`Error requesting permissions: ${error.message}`, 'error');
      return false;
    }
  };

  // Get registered tasks
  const getRegisteredTasks = async () => {
    try {
      const tasks = await TaskManager.getRegisteredTasksAsync();
      setRegisteredTasks(tasks);
      addLog(`Found ${tasks.length} registered tasks`, 'info');
      return tasks;
    } catch (error) {
      addLog(`Error getting tasks: ${error.message}`, 'error');
      return [];
    }
  };

  // Send test notification
  const sendTestNotification = async () => {
    try {
      const hasPermission = await checkNotificationPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please grant notification permissions first');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Manual Test',
          body: `Test notification sent at ${new Date().toLocaleTimeString()}`,
          data: { type: 'manual_test' },
          sound: 'default',
        },
        trigger: null,
      });
      
      addLog('Manual test notification sent', 'success');
    } catch (error) {
      addLog(`Error sending test notification: ${error.message}`, 'error');
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      addLog('All notifications cleared', 'success');
    } catch (error) {
      addLog(`Error clearing notifications: ${error.message}`, 'error');
    }
  };

  // Initialize data
  const initializeData = async () => {
    setRefreshing(true);
    await checkNotificationPermissions();
    await getRegisteredTasks();
    await checkBackgroundFetchStatus();
    setRefreshing(false);
  };

  // Refresh data
  const onRefresh = async () => {
    await initializeData();
  };

  useEffect(() => {
    initializeData();
  }, []);

  // Log app state changes
  useEffect(() => {
    addLog(`App state: ${appState}`, 'info');
  }, [appState]);

  // Log background task status changes
  useEffect(() => {
    addLog(`Background task status: ${backgroundTaskStatus}`, 'info');
  }, [backgroundTaskStatus]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'granted':
      case 'available':
      case 'active':
        return '#4CAF50';
      case 'denied':
      case 'restricted':
      case 'error':
        return '#F44336';
      default:
        return '#FF9800';
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      default: return '#666';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Status</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>App State:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(appState) }]}>
            {appState}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Background Tasks:</Text>
          <Text style={[styles.statusValue, { color: isBackgroundTaskActive ? '#4CAF50' : '#F44336' }]}>
            {isBackgroundTaskActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Background Fetch:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(backgroundTaskStatus) }]}>
            {backgroundTaskStatus}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Notifications:</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(notificationPermission) }]}>
            {notificationPermission || 'Unknown'}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Test Notifications:</Text>
          <Text style={styles.statusValue}>{notificationCount}</Text>
        </View>

        {lastBackgroundExecution && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Execution:</Text>
            <Text style={styles.statusValue}>
              {new Date(lastBackgroundExecution).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>

      {/* Controls Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎮 Controls</Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={requestNotificationPermissions}
        >
          <Text style={styles.buttonText}>Request Notification Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.successButton]} 
          onPress={initializeBackgroundTasks}
        >
          <Text style={styles.buttonText}>Start Background Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.dangerButton]} 
          onPress={stopBackgroundTasks}
        >
          <Text style={styles.buttonText}>Stop Background Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.warningButton]} 
          onPress={startTestIntervalNotifications}
        >
          <Text style={styles.buttonText}>Start Test Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.warningButton]} 
          onPress={stopTestIntervalNotifications}
        >
          <Text style={styles.buttonText}>Stop Test Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={sendTestNotification}
        >
          <Text style={styles.buttonText}>Send Manual Test</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={clearAllNotifications}
        >
          <Text style={styles.buttonText}>Clear All Notifications</Text>
        </TouchableOpacity>
      </View>

      {/* Registered Tasks Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Registered Tasks ({registeredTasks.length})</Text>
        {registeredTasks.map((task, index) => (
          <View key={index} style={styles.taskItem}>
            <Text style={styles.taskName}>{task.taskName}</Text>
            <Text style={styles.taskType}>{task.taskType}</Text>
          </View>
        ))}
        {registeredTasks.length === 0 && (
          <Text style={styles.emptyText}>No registered tasks</Text>
        )}
      </View>

      {/* Logs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Logs ({logs.length})</Text>
        {logs.map((log) => (
          <View key={log.id} style={styles.logItem}>
            <Text style={styles.logTimestamp}>{log.timestamp}</Text>
            <Text style={[styles.logMessage, { color: getLogColor(log.type) }]}>
              {log.message}
            </Text>
          </View>
        ))}
        {logs.length === 0 && (
          <Text style={styles.emptyText}>No logs yet</Text>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📖 Instructions</Text>
        <Text style={styles.instructionText}>
          1. Grant notification permissions first{'\n'}
          2. Start background tasks{'\n'}
          3. Start test notifications{'\n'}
          4. Put app in background to test{'\n'}
          5. Check if notifications appear every 3 seconds{'\n'}
          6. Return to app to see logs and status
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  button: {
    padding: 12,
    borderRadius: 6,
    marginVertical: 4,
    alignItems: 'center',
  },
  primaryButton: { backgroundColor: '#2196F3' },
  successButton: { backgroundColor: '#4CAF50' },
  dangerButton: { backgroundColor: '#F44336' },
  warningButton: { backgroundColor: '#FF9800' },
  infoButton: { backgroundColor: '#00BCD4' },
  secondaryButton: { backgroundColor: '#9E9E9E' },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  taskItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
    marginVertical: 2,
  },
  taskName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  taskType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});

export default BackgroundTaskDebugScreen;