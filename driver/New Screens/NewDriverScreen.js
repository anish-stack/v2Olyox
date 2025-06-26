import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

import HeaderNew from './components/Header/HeaderNew';
import RiderDataAndRechargeInfo from './components/HomeScreen/RiderDataAndRechargeInfo';
import RideSearching from './components/HomeScreen/RideSearching';
import Report from '../screens/Report/Report';
import Bonus from '../screens/Bonus/Bonus';
import useLocationTracking from '../hooks/useLocationTracking';

export default function NewHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    startLocationTracking,
    stopLocationTracking
  } = useLocationTracking();

  // Auto-start location tracking when component mounts
  useEffect(() => {
    const initializeLocationTracking = async () => {
      try {
        await startLocationTracking();
        console.log('✅ Location tracking started silently');
      } catch (err) {
        console.error('❌ Failed to start location tracking:', err);
      }
    };

    initializeLocationTracking();

    // Cleanup when component unmounts
    return () => {
      stopLocationTracking();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    console.log("🔄 Refreshing Home Screen...");
    setRefreshing(true);

    setTimeout(async () => {
      console.log("✅ Refresh complete, reloading app...");

      try {
        await Updates.reloadAsync();
      } catch (e) {
        console.error("❌ Error reloading app:", e);
        setRefreshing(false);
      }
    }, 1500);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderNew isRefresh={refreshing} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0d6efd']}
          />
        }
      >
        <RideSearching refreshing={refreshing} />
        <RiderDataAndRechargeInfo refreshing={refreshing} />
        <Report isRefresh={refreshing} />
        <Bonus />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    padding: 8,
    paddingBottom: 32,
  },
});