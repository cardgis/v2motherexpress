// Click interactions (menu, search, dialogs) are handled by React components.
// This script only keeps the Escape key handler for native dialogs.
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
  }
});
