import React, { Component } from "react";
import { View, Text, Button, Image, ScrollView } from "react-native";
import axios from "axios";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // If the error is related to user authentication, redirect to login
    if (error.toString().includes("User not found. Please register first.")) {
      this.props.navigation.navigate("Login");
      return;
    }

    axios.post("https://your-backend-api.com/log_error", {
      error: error.toString(),
      errorInfo: JSON.stringify(errorInfo),
      timestamp: new Date(),
    }).catch((backendError) => {
      console.error("Error reporting to backend:", backendError);
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Image 
            source={{ uri: "https://img.freepik.com/free-vector/oops-404-error-with-broken-robot-concept-illustration_114360-5529.jpg" }}
            style={{ width: 300, height: 200, marginBottom: 20 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "red", textAlign: "center" }}>
            Oops! Something went wrong.
          </Text>
          <Text style={{ fontSize: 16, marginVertical: 10, textAlign: "center" }}>
            {this.state.error ? this.state.error.toString() : "Unknown error occurred."}
          </Text>
          {this.state.errorInfo && (
            <Text style={{ fontSize: 14, color: "gray", marginBottom: 10, textAlign: "center" }}>
              Component: {this.state.errorInfo.componentStack}
            </Text>
          )}
          <Text style={{ fontSize: 14, fontStyle: "italic", textAlign: "center" }}>
            Try refreshing the page or checking the component's implementation.
          </Text>
          <Button title="Retry" onPress={this.handleRetry} color="#d64444" />
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundaryWrapper(props) {
  return <ErrorBoundary {...props} />;
}
