import api from './api'

export async function getDocumentContent(docIdOrName) {
  const response = await api.get(`/documents/${encodeURIComponent(docIdOrName)}/content`)
  return response.data
}

export async function getDocumentFileBlob(docIdOrName) {
  const response = await api.get(`/documents/${encodeURIComponent(docIdOrName)}/file`, {
    responseType: 'blob',
  })
  return response.data
}

export async function getDocumentPdfBlob(docIdOrName) {
  const response = await api.get(`/documents/${encodeURIComponent(docIdOrName)}/pdf`, {
    responseType: 'blob',
  })
  return response.data
}

export async function uploadDocument(file, department = null) {
  const formData = new FormData()
  formData.append('file', file)
  if (department) {
    formData.append('department', department)
  }
  const response = await api.post('/ingest', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export default {
  getDocumentContent,
  getDocumentFileBlob,
  getDocumentPdfBlob,
  uploadDocument,
}

