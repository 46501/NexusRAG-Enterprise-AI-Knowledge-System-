import { useRef, useState } from 'react'
import { uploadDocument } from '../services/auth'

export default function UploadButton() {
  const inputRef = useRef(null)
  const [status, setStatus] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('uploading')
    try {
      await uploadDocument(file)
      setStatus('done')
    } catch {
      setStatus('error')
    } finally {
      setTimeout(() => setStatus(null), 3000)
      e.target.value = ''
    }
  }

  const label = status === 'uploading' ? 'Uploading…'
    : status === 'done' ? 'Uploaded!'
    : status === 'error' ? 'Failed'
    : 'Upload doc'

  const color = status === 'done' ? 'text-green-600'
    : status === 'error' ? 'text-red-600'
    : 'text-gray-500 hover:text-gray-800'

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'uploading'}
        className={`text-sm transition-colors disabled:opacity-50 ${color}`}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={handleFile}
      />
    </>
  )
}
