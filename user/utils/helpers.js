import axios from 'axios'
import { tokenCache } from '../Auth/cache';
const BACKEND_URL = 'https://appapi.olyox.com/api/v1/user'
export const formatDate = (date) => {
  // Example helper function
  return new Date(date).toLocaleDateString();
};


export const createUserRegister = async (formdata) => {
 
  try {
    const data = await axios.post(`${BACKEND_URL}/register`, formdata)
    console.log(data.data)
    return data.data

  } catch (error) {
    console.log(error.response.data)
    return error.response
  }
}


export const verify_otp = async (formdata) => {
  try {
    const data = await axios.post(`${BACKEND_URL}/verify-user`, formdata)
    return data.data

  } catch (error) {
    return error.response
  }
}


export const resend_otp = async (formdata) => {
  try {
    const data = await axios.post(`${BACKEND_URL}/resend-otp`, formdata)
    return data.data

  } catch (error) {
    return error.response
  }
}


export const find_me = async () => {
  try {
    const token = await tokenCache.getToken('auth_token_db')
    const data = await axios.get(`https://appapi.olyox.com/api/v1/user/find_me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    console.log(data.data)
    return data.data

  } catch (error) {
    console.log("user error ", error.response.data.message)
    throw new Error(error.response.data.message)
  }
}

export const login = async (formData) => {
  try {
    console.log("login", formData)

    const data = await axios.post(`${BACKEND_URL}/login`, formData)

    return data.data

  } catch (error) {
    // console.log(error)
    return error.response
  }
}

export const findSettings = async () => {
  try {
    const response = await axios.get(`https://appapi.olyox.com/api/v1/admin/get_Setting`)
    return response.data
  } catch (error) {
    throw new Error(error.response.data.message || error.message)
  }
}