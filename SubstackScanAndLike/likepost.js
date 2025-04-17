// NOTE: Selectors MUST be updated based on current Substack structure!
(() => {const likeButton = document.querySelector('[role="button"][aria-label^="Like"]:not([aria-pressed="true"])');
  const signedOut = document.querySelector('button[data-href^="https://substack.com/sign-in"]');
  if (!signedOut && likeButton) { likeButton.click(); }
  })();