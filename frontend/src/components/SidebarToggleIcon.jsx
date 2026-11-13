/**
 * Sidebar Panel Toggle Icons (ChatGPT & Lucide panel-left / panel-right style)
 *
 * Visually represents a window panel with a collapsible sidebar section.
 * Shows filled/active visual state when expanded, and outline/collapsed state when collapsed.
 */

export function PanelLeftIcon({ isOpen = true, size = 15, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer panel box with smooth rounded corners */}
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      {/* Vertical sidebar divider */}
      <line x1="9" y1="3" x2="9" y2="21" />
      {/* Left panel section: filled when expanded to show active panel */}
      {isOpen ? (
        <rect
          x="3.75"
          y="3.75"
          width="4.5"
          height="16.5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.32"
          stroke="none"
        />
      ) : null}
    </svg>
  )
}

export function PanelRightIcon({ isOpen = true, size = 15, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer panel box with smooth rounded corners */}
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      {/* Vertical sidebar divider */}
      <line x1="15" y1="3" x2="15" y2="21" />
      {/* Right panel section: filled when expanded to show active panel */}
      {isOpen ? (
        <rect
          x="15.75"
          y="3.75"
          width="4.5"
          height="16.5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.32"
          stroke="none"
        />
      ) : null}
    </svg>
  )
}

