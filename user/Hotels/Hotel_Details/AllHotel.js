import { View, Text } from 'react-native'
import React from 'react'
import Top_Hotel from '../Top_Hotel/Top_Hotel'
import Layout from '../../components/Layout/_layout'

export default function AllHotel() {
    return (
        <View style={{ flex: 1 }}>
            <Layout>

            <Top_Hotel show={true} />
            </Layout>
        </View>
    )
}