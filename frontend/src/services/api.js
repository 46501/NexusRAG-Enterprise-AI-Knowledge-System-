import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        return api(original)
      } catch {
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

export default api
