import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (!original) return Promise.reject(err)

    const url = original.url || ''
    // Do not attempt token refresh on public auth actions or refresh endpoint itself
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    if (err.response?.status === 401 && !original._retry && !isAuthRoute) {
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
