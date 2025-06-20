import axios from "axios"
import { API_BASE_URL } from "../NewConstant";



export const NewRidePooling = async (riderId) => {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/new/pooling-rides-for-rider?riderId=${riderId}`
        );
        const ridesData = response.data.data;
        console.log("I am Ride Data", ridesData)
        if (!ridesData) {
            return null
        } else {
            return ridesData
        }

    } catch (error) {
        console.log(error?.response?.data)
        throw new Error(error?.response?.data)
    }
}

export const StatusOfRideComingRide = async (rideId, state) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/new/status-driver/${rideId}`
    );

    const rideStatus = response.data.data.ride_status;
    console.log("Ride status:", rideStatus);

    // If the ride is already assigned or cancelled, remove from list
    if (rideStatus === "driver_assigned" || rideStatus === "cancelled") {
      state.rides.delete(rideId);  // remove the ride from search result
      return { action: "remove", rideId };
    }

    // Else, keep or update the ride in state
    const updatedRide = response.data.data;
    state.rides.set(rideId, updatedRide);

    return { action: "update", rideId, ride: updatedRide };
  } catch (error) {
    console.error("Error while checking ride status", error?.response?.data);
    throw new Error(error?.response?.data);
  }
};
