import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export const styles = StyleSheet.create({
    container: {
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 12,
        marginVertical: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 8,

    },
    iconContainer: {
        backgroundColor: COLORS.zom,
        opacity: 0.83,
        padding: 12,
        borderRadius: 50,
        marginRight: 16,
    },
    icon: {
        width: 30,
        height: 30,
        // tintColor: '#FFFFFF',  
    },
    button: {
        flex: 1,
        backgroundColor: COLORS.text,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.5,
    }
});