import api from './api'

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password })
  return res.data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data
}

export async function uploadDocument(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/ingest', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
