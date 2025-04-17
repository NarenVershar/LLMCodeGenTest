// NOTE: Selectors MUST be updated based on current Substack structure!
(async () => {
    const response = { loggedIn: false, subscriptionUrls: [] };

    // 1. Check Login Status (Example: look for settings/account menu item)
    console.log('test1')
    await new Promise(resolve => setTimeout(resolve, 1000));
    const loggedOutIndicator = document.querySelector('div[id="substack-login"]')
    if (loggedOutIndicator) {
        console.log('ScrapeSubscriptions: Not logged in.');
        chrome.runtime.sendMessage(response);
        return;
    }
    response.loggedIn = true;
    console.log('ScrapeSubscriptions: Logged in.');

    // 2. Find and Click "More Subscriptions" Tab/Link within settings
    // THIS IS A GUESS - INSPECT THE SETTINGS PAGE
    // const expandSelector = 'a[href="/settings/subscriptions"], button[data-tab="subscriptions"]'; // Example selectors
    // let expandElement = document.querySelector(expandSelector);

    // if (expandElement) {
    //     console.log('ScrapeSubscriptions: Clicking more subscriptions link/tab...');
    //     expandElement.click();
    //     await new Promise(resolve => setTimeout(resolve, 1500)); //  Wait for content to potentially load Adjust delay as needed
    // } else {
    //     console.warn('ScrapeSubscriptions: Could not find Subscriptions link/tab.');
    // }
    
    // 3. Find Subscription Links
    const linkSelector = ['a[href*="/account"]']
    let foundLinks = document.querySelectorAll(linkSelector)

    console.log(`ScrapeSubscriptions: Found ${foundLinks.length} potential links.`);

    const baseUrls = []

    foundLinks.forEach(link => {
        baseUrls.push("https://"+link.hostname)
    });

    response.subscriptionUrls = baseUrls;
    console.log(baseUrls)
    console.log('ScrapeSubscriptions: Extracted base URLs:', response.subscriptionUrls);

    chrome.runtime.sendMessage(response);
})();