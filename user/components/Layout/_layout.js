import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Header from './Top/Header';
import BottomNav from './Bottom/Bottom.nav';
import {  StyleSheet, View } from 'react-native';
import { useState } from 'react';
import HeaderWithBack from './Top/HeaderWithBack';



export default function Layout({ children, isHeaderShown = true, isBottomNavShown = true ,isHeaderWithBackShown=false , title }) {
    const [activeTab, setActiveTab] = useState('Home');
    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>

                {isHeaderShown && <Header />}
                {isHeaderWithBackShown  && <HeaderWithBack title={title} />}

                <View style={styles.content}>
                    {children}
                </View>
                {isBottomNavShown && <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />}
            </SafeAreaView>
        </SafeAreaProvider>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    content: {
        flex: 1,

    },
});