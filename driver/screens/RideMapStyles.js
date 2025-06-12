import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
  },
  
  // Map styles
  map: {
    flex: 1,
  },
  
  // Marker styles
  pickupMarker: {
    backgroundColor: "#4CAF50",
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  dropMarker: {
    backgroundColor: "#F44336",
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // Connection status styles
  connectionStatus: {
    position: "absolute",
    top: 50,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  connectionText: {
    color: "white",
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "500",
  },
  
  // Navigation button styles
  pickupNavigationButton: {
    position: "absolute",
    bottom: 120,
    left: 15,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: width * 0.6,
  },
  
  pickupNavigationText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  
  dropNavigationButton: {
    position: "absolute",
    bottom: 60,
    left: 15,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: width * 0.6,
  },
  
  dropNavigationText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  
  // Loading overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -25 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1000,
  },
  
  loadingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Error styles
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 15,
    right: 15,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  errorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  
  // Utility styles
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Responsive dimensions
  responsiveWidth: {
    maxWidth: width * 0.8,
  },
  
  fullWidth: {
    width: '100%',
  },
  
  // Color constants for reuse
  primaryColor: '#FF3B30',
  secondaryColor: '#4CAF50',
  errorColor: '#F44336',
  successColor: '#4CAF50',
  warningColor: '#FF9800',
  
  // Common padding/margin values
  smallPadding: 8,
  mediumPadding: 16,
  largePadding: 24,
  
  smallMargin: 8,
  mediumMargin: 16,
  largeMargin: 24,
});