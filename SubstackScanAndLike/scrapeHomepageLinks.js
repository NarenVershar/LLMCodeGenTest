// NOTE: Selectors MUST be updated based on current Substack structure!
(async () => {
    const postUrls = new Set();
    const baseUrl = window.location.origin; // e.g., https://xyz.substack.com
    const postLinkPattern = new RegExp(`^${baseUrl}/p/[a-zA-Z0-9-]+`); // Common pattern

    console.log(`ScrapeHomepageLinks: Scraping ${baseUrl} for post links.`);
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Find all links on the page
    document.querySelectorAll('a').forEach(link => {
        if (link.href && postLinkPattern.test(link.href)) {
            // Normalize URL (remove query params/hash)
            const url = new URL(link.href);
            postUrls.add(url.origin + url.pathname);
        }
        // Add more specific selectors if needed, e.g., links within a certain feed container
        // Example: document.querySelectorAll('.post-feed-item a.post-link')
    });

    console.log(`ScrapeHomepageLinks: Found ${postUrls.size} potential post links.`);
    chrome.runtime.sendMessage({ postUrls: Array.from(postUrls) });
})();