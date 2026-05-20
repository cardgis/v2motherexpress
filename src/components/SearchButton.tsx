'use client';

export function SearchButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="uk-navbar-toggle search-btn" data-open-search="" onClick={onClick} aria-label="Rechercher">
      <svg className="search-btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
