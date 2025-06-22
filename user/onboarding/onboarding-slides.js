import axios from "axios";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; 

export const slidesFetch = async () => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const { data } = await axios.get('https://appapi.olyox.com/api/v1/admin/get_onboarding_slides');
      return data?.data;
    } catch (error) {
      attempt++;

      if (attempt >= MAX_RETRIES) {
        if (error.response) {
          console.error("❌ Error fetching slides:", error.response.data);
          throw new Error(error.response.data.message || "Failed to fetch");
        } else {
          console.error("❌ Error fetching slides:", error.message);
          throw new Error(error.message || "Failed to fetch");
        }
      } else {
        console.warn(`⚠️ Retry attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
      }
    }
  }
};
