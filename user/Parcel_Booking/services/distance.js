
const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180
  }
  
  // Calculate distance between two points using Haversine formula
  const calculateHaversineDistance = (point1, point2) => {
    const R = 6371 // Earth's radius in kilometers
  
    const lat1 = Number.parseFloat(point1.lat)
    const lng1 = Number.parseFloat(point1.lng)
    const lat2 = Number.parseFloat(point2.lat)
    const lng2 = Number.parseFloat(point2.lng)
  
    // Handle invalid coordinates
    if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
      console.error("Invalid coordinates provided:", { point1, point2 })
      return 0
    }
  
    const dLat = toRadians(lat2 - lat1)
    const dLng = toRadians(lng2 - lng1)
  
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
  
    return distance
  }
  
  // Calculate total distance including stops
  export const calculateDistance = async (pickup, dropoff, stops = []) => {
    try {
      // Filter out stops with invalid coordinates
      const validStops = stops.filter(
        (stop) =>
          stop && stop.lat && stop.lng && !isNaN(Number.parseFloat(stop.lat)) && !isNaN(Number.parseFloat(stop.lng)),
      )
  
      let totalDistance = 0
      let currentPoint = pickup
  
      // Add distance from pickup to each stop
      for (const stop of validStops) {
        const segmentDistance = calculateHaversineDistance(currentPoint, stop)
        totalDistance += segmentDistance
        currentPoint = stop
      }
  
      // Add distance from last stop (or pickup if no stops) to dropoff
      const finalSegmentDistance = calculateHaversineDistance(currentPoint, dropoff)
      totalDistance += finalSegmentDistance
  
      // Add 10% for road routes (since Haversine calculates direct distance)
      const adjustedDistance = totalDistance * 1.1
  
      return adjustedDistance.toFixed(2)
    } catch (error) {
      console.error("Error calculating distance:", error)
      return "0.00"
    }
  }
  
  // For future implementation: API-based distance calculation
  export const calculateDistanceWithAPI = async (pickup, dropoff, stops = []) => {

    return calculateDistance(pickup, dropoff, stops)
  }
  