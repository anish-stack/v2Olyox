import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import React from 'react'
import { MaterialIcons} from '@expo/vector-icons';

export default function GuestCounterIos({ label, count, onIncrease, onDecrease }) {
  return (
    <View style={styles.iosCounterRow}>
      <Text style={styles.iosLabel}>{label}</Text>
      <View style={styles.iosCounterControls}>
        <TouchableOpacity 
          style={[styles.iosButton, count === 0 ? styles.iosButtonDisabled : null]} 
          onPress={onDecrease}
          disabled={count === 0}
        >
          <MaterialIcons name="remove" size={22} color={count === 0 ? "#CCCCCC" : "#333"} />
        </TouchableOpacity>
        
        <Text style={styles.iosCountText}>{count}</Text>
        
        <TouchableOpacity 
          style={styles.iosButton} 
          onPress={onIncrease}
        >
          <MaterialIcons name="add" size={22} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
    // Android styles
  
    iosGuestContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#F9F9F9',
      borderRadius: 8,
      marginVertical: 8,
    },
    iosCounterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: '#E0E0E0',
    },
    iosLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: '#333',
    },
    iosCounterControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iosButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#EEEEEE',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iosButtonDisabled: {
        backgroundColor: '#F5F5F5',
      },
      iosCountText: {
        fontSize: 18,
        fontWeight: '600',
        marginHorizontal: 16,
        minWidth: 20,
        textAlign: 'center',
      }
    });