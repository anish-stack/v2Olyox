import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates'; // ✅ Import expo-updates

import HeaderNew from './components/Header/HeaderNew';
import RiderDataAndRechargeInfo from './components/HomeScreen/RiderDataAndRechargeInfo';
import RideSearching from './components/HomeScreen/RideSearching';
import Report from '../screens/Report/Report';
import Bonus from '../screens/Bonus/Bonus';
// import Demo from '../Demo';

export default function NewHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    console.log("🔄 Refreshing Home Screen...");
    setRefreshing(true);

    setTimeout(async () => {
      console.log("✅ Refresh complete, reloading app...");

      try {
        await Updates.reloadAsync(); // 🔁 Force app reload
      } catch (e) {
        console.error("❌ Error reloading app:", e);
        setRefreshing(false); // fallback if reload fails
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d6efd']} />
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
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
});
