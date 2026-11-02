import api from './api'

export async function submitFeedback({
  query_text,
  answer_text,
  is_positive,
  feedback_reason = null,
  feedback_comment = null,
  sources_cited = null,
}) {
  const res = await api.post('/feedback', {
    query_text,
    answer_text,
    is_positive,
    feedback_reason,
    feedback_comment,
    sources_cited,
  })
  return res.data
}

export async function getAdminFeedbacks({ status = 'all', offset = 0, limit = 50 } = {}) {
  const res = await api.get('/admin/feedbacks', {
    params: { status, offset, limit },
  })
  return res.data
}

export async function resolveFeedback(feedbackId, resolved = true) {
  const res = await api.patch(`/admin/feedbacks/${feedbackId}/resolve`, null, {
    params: { resolved },
  })
  return res.data
}

