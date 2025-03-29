// --- Configuration ---
const sitesToLike = [
    /^https?:\/\/([a-zA-Z0-9-]+\.)*tortugamedia\.net\//i,
    // Add other Regex patterns here for different Substack URLs
    // Example for any direct substack.com domain:
    // /^https?:\/\/([a-zA-Z0-9-]+)\.substack\.com\//i,
  ];
  const LIKE_DELAY_MS = 10000; //  10 seconds
  
  // --- State ---
  let likeCount = 0;
  let activeTabTimers = {}; // Stores { tabId: timerId }
  
  // --- Functions ---
  
  function checkUrlMatch(url) {
    if (!url) return false;
    return sitesToLike.some(regex => regex.test(url));
  }
  
  function clearTimerForTab(tabId) {
    if (activeTabTimers[tabId]) {
      clearTimeout(activeTabTimers[tabId]);
      delete activeTabTimers[tabId];
      // console.log(`Cleared timer for tab ${tabId}`);
    }
  }
  
  function attemptLikeAction(tabId, urlWhenTimerStarted) {
    // Re-verify the tab is still active and the URL hasn't changed drastically
    chrome.tabs.get(tabId, (tab) => {
      // Check if tab still exists, is active, and URL still matches original intent
      if (chrome.runtime.lastError || !tab || !tab.active || tab.url !== urlWhenTimerStarted || !checkUrlMatch(tab.url)) {
        // console.log(`Tab ${tabId} state changed or URL mismatch. Cancelling like.`);
        delete activeTabTimers[tabId]; // Ensure timer reference is removed
        return;
      }
  
      // console.log(`Timer fired for tab ${tabId}. Injecting content script into ${tab.url}`);
  
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      }).catch(err => console.error(`Failed to inject script into tab ${tabId}: ${err}`));
  
      // Clear the timer reference *after* attempting injection
      delete activeTabTimers[tabId];
    });
  }
  
  function handleTabActivation(tabId) {
     chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
          console.warn(`Could not get tab info for ${tabId}: ${chrome.runtime.lastError?.message}`);
          clearTimerForTab(tabId);
          return;
      }
  
      // Clear any existing timer for this tab before starting a new one
      clearTimerForTab(tabId);
  
      if (tab.active && checkUrlMatch(tab.url)) {
        // console.log(`Tab ${tabId} activated and URL matches. Starting timer for ${tab.url}`);
        activeTabTimers[tabId] = setTimeout(() => {
          attemptLikeAction(tabId, tab.url); // Pass the URL at the time timer started
        }, LIKE_DELAY_MS);
      } else {
         // console.log(`Tab ${tabId} is not active or URL doesn't match. No timer started.`);
      }
    });
  }
  
  // --- Event Listeners ---
  
  // Fired when the active tab in a window changes
  chrome.tabs.onActivated.addListener((activeInfo) => {
    // console.log(`Tab activated: ${activeInfo.tabId}`);
    handleTabActivation(activeInfo.tabId);
  
    // Clear timers for other tabs in the *same* window that just became inactive
    chrome.tabs.query({ windowId: activeInfo.windowId }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error(`Error querying tabs: ${chrome.runtime.lastError.message}`);
        return;
      }
      tabs.forEach((tab) => {
        if (tab.id !== activeInfo.tabId) {
          clearTimerForTab(tab.id);
        }
      });
    });
  });
  
  // Fired when a tab is updated (URL change, loading status)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We are interested when the page finishes loading and the tab is active
     if (changeInfo.status === 'complete' && tab.active) {
      // console.log(`Tab updated and complete: ${tabId}, URL: ${tab.url}`);
      handleTabActivation(tabId); // Re-evaluate if timer should run
     } else if (!tab.active) {
       // If tab becomes inactive for any reason during loading or otherwise
       clearTimerForTab(tabId);
     }
     // If URL changes to non-matching, handleTabActivation will clear the timer anyway
  });
  
  // Fired when a tab is closed
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // console.log(`Tab removed: ${tabId}`);
    clearTimerForTab(tabId);
  });
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.liked && sender.tab) {
      likeCount++;
      console.log(`Auto-liked post: ${message.url}. Total likes this session: ${likeCount}`);
    } else if (message.error) {
      console.warn(`Content script error on ${sender.tab?.url}: ${message.error}`);
    }
  });
  
  // Optional: Log when the extension starts
  console.log("Substack Auto-Liker background script loaded.");