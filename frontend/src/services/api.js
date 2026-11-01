import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL,
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
        return api(original)
      } catch {
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

export default api
