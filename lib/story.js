const { IgApiClient } = require("instagram-private-api");

/**
 * 
 * @param {IgApiClient} ig 
 * @param {string} username 
 * @returns 
 */
const fetchStories = async (ig, username) => {
    try {
        const target = await ig.user.getIdByUsername(username)
        const reelsFeed = ig.feed.reelsMedia({ // working with reels media feed (stories feed)
            userIds: [target], // you can specify multiple user id's, "pk" param is user id,
        });
        const storyItems = await reelsFeed.items();
        return storyItems
    } catch (error) {
        throw error
    }
}

module.exports = {
    fetchStories
}