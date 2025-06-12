import { View, Text } from 'react-native'
import React from 'react'
import Layout from '../../components/Layout/_layout'
import TopFood from './TopFood'

export default function AllFoods() {
    return (
        <View style={{ flex: 1 }}>
            <Layout>
                <TopFood show={true} />
            </Layout>
        </View>
    )
}