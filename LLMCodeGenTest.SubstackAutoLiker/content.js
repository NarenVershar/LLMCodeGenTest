(function() {
    // Selector for the Substack like button (this might need adjustment if Substack changes its HTML)
    // It looks for a button with aria-label starting with Like that is NOT already pressed.
    const likeButtonSelector = '[role="button"][aria-label^="Like"]:not([aria-pressed="true"])'
  
    const likeButton = document.querySelector(likeButtonSelector);

    const signInSelector = 'button[data-href^="https://substack.com/sign-in"]'
    
    const signedOut = document.querySelector(signInSelector);

    if (signedOut) {
      console.log("Auto-Liker: Not signed in to any acount not attempting Like.");

    } else if (likeButton) {

  
      console.log("Auto-Liker: Found like button. Attempting click.");
      likeButton.click();
  
      // Send a message back to the background script to count the like
      chrome.runtime.sendMessage({ liked: true, url: window.location.href })
        .catch(err => console.warn("Auto-Liker: Could not send 'liked' message to background.", err)); // Handle potential error if background isn't ready
  
    } else {
      console.log("Auto-Liker: Like button not found or already liked.");
    }
  
  })(); // Immediately Invoked Function Expression (IIFE) to avoid polluting global scope