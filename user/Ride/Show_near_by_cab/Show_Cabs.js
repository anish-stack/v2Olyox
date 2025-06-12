import { View, Text } from 'react-native'
import React from 'react'
import ShowMap from './ShowMap'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView } from 'react-native'

export default function Show_Cabs() {
  const route = useRoute()
  const { data } = route.params || {}

  return (
    <SafeAreaView style={{flex:1}}>
  
          <ShowMap data={data} />
      
    </SafeAreaView>
  )
}