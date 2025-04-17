// --- Configuration ---
const SETTINGS_URL = "https://substack.com/settings";
const ARTICLE_PROCESSING_DELAY_MS = 2500; // Delay between liking attempts
const HOMEPAGE_SCRAPE_DELAY_MS = 500; // Delay between scraping homepages
const TAB_LOAD_TIMEOUT_MS = 20000;
const STORAGE_KEY = "substackArticles";

// --- Content Script Files ---
const SCRAPE_SUBS_SCRIPT = "scrapeSubscriptions.js";
const SCRAPE_HOME_SCRIPT = "scrapeHomepageLinks.js";
const LIKE_POST_SCRIPT = "likePost.js";

// --- State ---
let isBusy = false; // Prevent multiple simultaneous runs
let sessionLikeCount = 0; // Count likes for the liking phase of this run

// --- Helper Functions ---

function updatePopupStatus(message) {
    console.log("Background Status:", message);
    chrome.runtime.sendMessage({ action: "updatePopupStatus", message: message }).catch(() => {});
}

// Wait for a specific tab to complete loading (same as before)
function waitForTabLoad(tabId, timeout = TAB_LOAD_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.error(`Timeout waiting for tab ${tabId} to load.`);
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error(`Timeout waiting for tab ${tabId} to load.`));
        }, timeout);
        const listener = (updatedTabId, changeInfo, tab) => {
             if (settled) return;
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                settled = true;
                clearTimeout(timeoutId);
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => resolve(tab), 300); // Extra delay
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        chrome.tabs.get(tabId, (currentTab) => {
            if (settled) return;
            if (chrome.runtime.lastError) {
                settled = true; clearTimeout(timeoutId); chrome.tabs.onUpdated.removeListener(listener); reject(chrome.runtime.lastError);
            } else if (currentTab?.status === 'complete') {
                settled = true; clearTimeout(timeoutId); chrome.tabs.onUpdated.removeListener(listener); setTimeout(() => resolve(currentTab), 300);
            }
        });
    });
}


// Execute script and wait for a response message (needed for scraping)
function executeScriptWaitForResponse(tabId, file) {
    return new Promise((resolve, reject) => {
        const messageListenerTimeout = TAB_LOAD_TIMEOUT_MS * 1.5; // Longer timeout for script + message
        let listener; // Declare listener variable

        const timeoutId = setTimeout(() => {
            if (listener) chrome.runtime.onMessage.removeListener(listener); // Clean up listener
            reject(new Error(`Timeout waiting for response from ${file} in tab ${tabId}`));
        }, messageListenerTimeout);

        listener = (message, sender, sendResponse) => {
            if (sender.tab?.id === tabId && message) {
                clearTimeout(timeoutId); // Clear the timeout
                chrome.runtime.onMessage.removeListener(listener); // Clean up listener
                resolve(message); // Resolve with the message
            }
            // Indicate listener is synchronous (or handle async if needed)
             return false;
        };

        chrome.runtime.onMessage.addListener(listener);

        chrome.scripting.executeScript({ target: { tabId: tabId }, files: [file] })
            .catch((error) => {
                clearTimeout(timeoutId); // Clear timeout on injection error
                chrome.runtime.onMessage.removeListener(listener); // Clean up listener
                console.error(`Failed to inject script ${file} into tab ${tabId}:`, error);
                reject(error);
            });
    });
}


// --- Core Scan and Like Logic ---

async function startScanAndLikeProcess() {
    if (isBusy) {
        updatePopupStatus("Process already running.");
        return { status: "Already running." };
    }
    isBusy = true;
    sessionLikeCount = 0; // Reset like count for this run
    updatePopupStatus("Starting scan & like process...");

    let settingsWindowId = null;
    let newlyFoundArticles = 0;

    try {
        // ===== Step 1: Scrape Subscriptions =====
        // updatePopupStatus("Opening Substack settings...");
        // const settingsWindow = await chrome.windows.create({ url: SETTINGS_URL, type: "normal" });
        // settingsWindowId = settingsWindow.id;
        // const settingsTabId = settingsWindow.tabs?.[0]?.id;
        // if (!settingsTabId) throw new Error("Failed to get settings tab ID.");

        // await waitForTabLoad(settingsTabId);
        // updatePopupStatus("Checking login & subscriptions...");

        // const subResult = await executeScriptWaitForResponse(settingsTabId, SCRAPE_SUBS_SCRIPT);
        // if (!subResult?.loggedIn) {
        //     updatePopupStatus("Not logged into Substack or failed to check.");
        //     throw new Error("Not logged in or failed subscription check."); // Stop the process
        // }

        // const subscriptionBaseUrls = subResult.subscriptionUrls || [];
        // if (subscriptionBaseUrls.length === 0) {
        //     updatePopupStatus("No subscriptions found.");
        //     throw new Error("No subscriptions found."); // Stop the process
        // }


        // updatePopupStatus(`Found ${subscriptionBaseUrls.length} subscriptions. Closing settings...`);
        // await chrome.windows.remove(settingsWindowId).catch(e => console.warn("Could not close settings window"));
        // settingsWindowId = null; // Mark as closed

        // ===== Step 2: Scrape Homepages for Article Links =====
        const subscriptionBaseUrls = ['https://www.waltbismarck.com/', 'https://ultimatum.substack.com/']
        updatePopupStatus("Scanning home pages for new article links...");
        const currentData = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};

        for (const baseUrl of subscriptionBaseUrls) {
            updatePopupStatus(`Scanning: ${baseUrl.substring(0, 40)}...`);
            let homeTabId = null;
            try {
                const homeTab = await chrome.tabs.create({ url: baseUrl, active: false });
                homeTabId = homeTab.id;
                await waitForTabLoad(homeTabId);

                const postsResult = await executeScriptWaitForResponse(homeTabId, SCRAPE_HOME_SCRIPT);
                if (postsResult?.postUrls?.length > 0) {
                    for (const postUrl of postsResult.postUrls) {
                        if (!currentData[postUrl]) { // Only add if URL is new
                            currentData[postUrl] = {
                                url: postUrl,
                                baseUrl: baseUrl,
                                saved: false // Mark as unscraped (content not fetched)
                            };
                            newlyFoundArticles++;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing homepage ${baseUrl}:`, error);
                updatePopupStatus(`Error scanning ${baseUrl.substring(0,40)}. Skipping.`);
            } finally {
                 if (homeTabId) await chrome.tabs.remove(homeTabId).catch(e => console.warn(`Could not close homepage tab ${homeTabId}`));
                 await new Promise(resolve => setTimeout(resolve, HOMEPAGE_SCRAPE_DELAY_MS)); // Small delay
            }
        }

        await chrome.storage.local.set({ [STORAGE_KEY]: currentData });
        updatePopupStatus(`Scan complete. Found ${newlyFoundArticles} new article links. Total: ${Object.keys(currentData).length}.`);

        // ===== Step 3: Like All Stored Articles =====
        const articlesToProcess = Object.values(currentData);
        if (articlesToProcess.length === 0) {
            updatePopupStatus("No articles in storage to like.");
            throw new Error("No articles to like."); // Stop if storage is empty
        }

        updatePopupStatus(`Starting liking attempts for ${articlesToProcess.length} articles...`);
        let processedCount = 0;

        for (const article of articlesToProcess) {
             if (!article?.url?.startsWith('http')) {
                console.warn("Skipping invalid article data during like phase:", article);
                processedCount++;
                continue;
            }

            processedCount++;
            updatePopupStatus(`Liking ${processedCount}/${articlesToProcess.length}:\n${article.url.substring(0, 50)}...`);
            let articleTabId = null;

            try {
                const articleTab = await chrome.tabs.create({ url: article.url, active: false });
                articleTabId = articleTab.id;
                await waitForTabLoad(articleTabId);
                await chrome.scripting.executeScript({ target: { tabId: articleTabId }, files: [LIKE_POST_SCRIPT] });
                // likePost.js sends message on success, caught by listener below
            } catch (error) {
                console.error(`Error processing like for ${article.url}:`, error);
                updatePopupStatus(`Error liking ${processedCount}. Skipping.`);
            } finally {
                if (articleTabId) await chrome.tabs.remove(articleTabId).catch(e => console.warn(`Could not close article tab ${articleTabId}`));
                await new Promise(resolve => setTimeout(resolve, ARTICLE_PROCESSING_DELAY_MS));
            }
        } // End liking loop

        updatePopupStatus(`Finished scan & like process.\nFound ${newlyFoundArticles} new articles.\nAttempted ${processedCount} likes.\nLikes confirmed this run: ${sessionLikeCount}.`);

    } catch (error) {
        console.error("Error during scan & like process:", error);
        updatePopupStatus(`Error: ${error.message}`);
        if (settingsWindowId) await chrome.windows.remove(settingsWindowId).catch(e => console.warn("Could not close settings window on error"));
    } finally {
        isBusy = false; // Ensure flag is reset
    }
    return { status: "Scan & like process finished." }; // Final status
}


// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScanAndLike") {
        startScanAndLikeProcess(); // Don't await here, let it run in background
        sendResponse({ status: "Scan & like process initiated..." }); // Acknowledge start
        return true; // Indicate potential async work (though we respond immediately)
    }

    // Listen for 'liked' message from likePost.js
    if (request.liked && sender.tab) {
        sessionLikeCount++;
        console.log(`Like confirmed via message: ${request.url}. Total likes this run: ${sessionLikeCount}`);
        // Do not sendResponse here
    }

    return false; // Default return for synchronous message handling if no case matched
});

// Log when the script loads
console.log("Substack Scan & Liker background script loaded.");