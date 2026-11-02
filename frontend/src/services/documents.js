import api from './api'

export async function getDocumentContent(docIdOrName) {
  const response = await api.get(`/documents/${encodeURIComponent(docIdOrName)}/content`)
  return response.data
}

export default {
  getDocumentContent,
}

