import React, { Component } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { MaterialCommunityIcons } from '@expo/vector-icons';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorLocation: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    // Extract error location if possible
    const errorLocation = this.extractErrorLocation(errorInfo);

    this.setState({
      errorInfo,
      errorLocation
    });
  }

  extractErrorLocation(errorInfo) {
    if (errorInfo && errorInfo.componentStack) {
      // Extract first line of component stack which typically contains file and line number
      const locationMatch = errorInfo.componentStack.match(/in\s+([^\n]+)/);
      return locationMatch ? locationMatch[1] : "Unknown component";
    }
    return "Unknown location";
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorLocation: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.errorCard}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={80}
                color="#FF6B6B"
              />

              <Text style={styles.errorTitle}>
                Oops! Something Went Wrong
              </Text>

              <Text style={styles.errorMessage}>
                We encountered an unexpected error in {this.state.errorLocation}.
              </Text>

              <Text style={styles.errorDetails}>
                Error: {this.state.error?.toString()}
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={this.handleRetry}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.retryButtonText}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorCard: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center'
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center'
  },
  errorDetails: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center'
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10
  }
});

// Wrapper to ensure type checking
export default function ErrorBoundaryWrapper({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}