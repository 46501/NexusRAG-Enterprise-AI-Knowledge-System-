export default function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 px-3.5 py-2.5"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px 16px 16px 16px',
        }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'rgba(255,255,255,0.30)', animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
