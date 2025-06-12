import axios from 'axios'
import { API_URL_V1 } from '../constants/Google'

export const checkBhDetails = async (BhId) => {
    try {
        const response = await axios.post(`${API_URL_V1}/check-bh-id`, {
            bh: BhId
        })
        
        return response.data
    } catch (error) {
        throw new Error(error.response.data.message || error.message || "Please reload the screen")
    }
}