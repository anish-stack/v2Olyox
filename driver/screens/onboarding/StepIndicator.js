import { View, StyleSheet } from "react-native"

const StepIndicator = ({ currentStep, totalSteps }) => (
  <View style={styles.container}>
    {[...Array(totalSteps)].map((_, index) => (
      <View
        key={index}
        style={[
          styles.step,
          index < currentStep && styles.completedStep,
          index === currentStep - 1 && styles.currentStep,
        ]}
      />
    ))}
  </View>
)

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  step: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ccc",
    marginHorizontal: 5,
  },
  completedStep: {
    backgroundColor: "#e51e25",
  },
  currentStep: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e51e25",
  },
})

export default StepIndicator

