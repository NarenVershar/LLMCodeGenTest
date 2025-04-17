const startButton = document.getElementById('startButton');
const statusDiv = document.getElementById('status');

function updateStatus(message) {
    console.log("Popup Status:", message); // Log for debugging
    statusDiv.textContent = message;
}

startButton.addEventListener('click', () => {
  updateStatus('Starting scan & like process...');
  startButton.disabled = true; // Prevent multiple clicks

  // Use a generic action name for the combined process
  chrome.runtime.sendMessage({ action: "startScanAndLike" }, (response) => {
      if (chrome.runtime.lastError) {
          updateStatus(`Error: ${chrome.runtime.lastError.message}`);
          console.error("Error sending startScanAndLike message:", chrome.runtime.lastError);
           startButton.disabled = false; // Re-enable on immediate error
      } else if (response) {
          // Initial response might just confirm receipt or start status
          updateStatus(response.status);
      }
      // Button might be re-enabled later by a final status update from background
  });
});

// Listen for ongoing status updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updatePopupStatus") {
        updateStatus(request.message);
        // Optionally re-enable button on final messages
        if (request.message.toLowerCase().includes("finished") || request.message.toLowerCase().includes("error") || request.message.toLowerCase().includes("not logged in") || request.message.toLowerCase().includes("no subscriptions")) {
             startButton.disabled = false;
        }
    }
});

// Initial status
updateStatus("Ready to scan for new articles and like.");