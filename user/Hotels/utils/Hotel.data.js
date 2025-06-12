import axios from 'axios'

export const findMyNearHotels = async (lat, lng) => {
    try {
        const response = await axios.get(`https://appapi.olyox.com/api/v1/hotels/find-near-by-hotels?lat=${lat}&lng=${lng}`)

        return response.data.data
    } catch (error) {
        console.log(error)
        throw new Error(error.response.data.message)
    }
}

export const findHotelsDetailsAndList = async (hotel_id) => {
    console.log(hotel_id)
    try {
        const response = await axios.get(`https://appapi.olyox.com/api/v1/hotels/find-hotel-details/${hotel_id}`)
        return response.data
    } catch (error) {
        console.log(error)
        return error.response.data.message
    }
}


export const findHotelsDetails = async (listing_id) => {
    try {
        const response = await axios.get(`https://appapi.olyox.com/api/v1/hotels/hotel-details/${listing_id}`)
        return response.data
    } catch (error) {
        console.log(error)
        return error.response.data.message
    }
}