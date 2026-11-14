'use client';

export function OffcanvasButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="menu-btn menu-btn--icon"
      type="button"
      data-open-menu=""
      onClick={onClick}
      aria-label="Ouvrir la navigation"
    >
      <svg className="menu-btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
