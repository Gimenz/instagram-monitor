const { withFbns } = require('instagram_mqtt');
const { IgApiClient } = require('instagram-private-api');
const { Telegram } = require('telegraf');
const db = require('./db');
const { readState, loginToInstagram, saveState, color } = require('./utils');
const { fetchStories } = require('./lib/story');
const { FeedFactory } = require('instagram-private-api/dist/core/feed.factory');
require('dotenv').config();

if (!process.env.IG_USERNAME || !process.env.IG_PASSWORD || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_USER_ID) {
    console.log(color('[!] fill all authentication requires on .env', 'red'));
    process.exit();
}

const bot = new Telegram(process.env.TELEGRAM_BOT_TOKEN);
var printDate = new Date().toLocaleString('id', { dateStyle: 'long', timeStyle: 'medium' });

(async () => {
    try {
        const ig = withFbns(new IgApiClient());

        ig.state.generateDevice(process.env.IG_USERNAME);

        // this will set the auth and the cookies for instagram
        await readState(ig);
        // this logs the client in
        const loggedUser = await loginToInstagram(ig);

        // you received a notification
        ig.fbns.on('push', async push => {
            //console.log(push);
            try {
                if (push.pushCategory && push.pushCategory == 'subscribed_reel_post') {
                    const userId = push.sourceUserId
                    // getting profile info
                    const { username } = await ig.user.info(userId);
                    console.log(color('[NEW STORY]'), color(`${printDate}`, 'yellow'), '~ from =>', color(`[ ${username} ]`, 'cyan'));
                    // fetch all stories from user
                    const story = await fetchStories(ig, username)
                    story.forEach(async (v, i, a) => {
                        if (!db.isExists(username, v.id)) {
                            db.addStoryId(username, v.id, v.expiring_at)
                            const opts = {
                                caption: `<b>[New Stories]</b> - <i>Story from <a href="https://www.instagram.com/${username}">@${username}</a></i>\nPosted at : ${new Date(v.taken_at * 1000).toLocaleString('id', { dateStyle: 'full', timeStyle: 'long' })}`,
                                parse_mode: 'HTML'
                            }
                            // media_type 1 is image and 2 is video
                            if (v.media_type == 1) {
                                await bot.sendPhoto(process.env.TELEGRAM_USER_ID, v.image_versions2.candidates[0].url, opts)
                            } else {
                                await bot.sendVideo(process.env.TELEGRAM_USER_ID, v.video_versions[0].url, opts)
                            }
                        }
                    })
                } else if (push.pushCategory == 'post' || push.pushCategory == 'clips_subscribe_connected') {
                    let item = (await ig.media.info(push.actionParams.media_id)).items[0]
                    console.log(color('[NEW POST]'), color(`${printDate}`, 'yellow'), '~ from =>', color(`[ ${item.user.username} ]`, 'cyan'));
                    // do like
                    if (process.env.IG_POST_AUTOLIKE) {
                        var doLike = await ig.media.like({
                            mediaId: item.id,
                            moduleInfo: {
                                module_name: 'profile',
                                user_id: loggedUser.pk,
                                username: loggedUser.username
                            }
                        })
                    }

                    const opts = {
                        caption: `<b>[New Post]</b> - <i>from <a href="https://www.instagram.com/${item.user.username}">@${item.user.username}</a></i>\n` +
                            `Posted at : ${new Date(item.taken_at * 1000).toLocaleString('id', { dateStyle: 'full', timeStyle: 'long' })}\n` +
                            `Caption : ${item.caption.text}` +
                            `${process.env.IG_POST_AUTOLIKE ? `\nLiked : ${doLike.status == 'ok' ? 'Success' : 'Fail'}` : ''}`,
                        parse_mode: 'HTML'
                    }
                    // media_type 1 is image and 2 is video, 8 ? carousel
                    if (item.media_type == 1) {
                        await bot.sendPhoto(process.env.TELEGRAM_USER_ID, item.image_versions2.candidates[0].url, opts)
                    } else if (item.media_type == 2) {
                        await bot.sendVideo(process.env.TELEGRAM_USER_ID, item.video_versions[0].url, opts)
                    } else if (item.media_type == 8) {
                        bot.sendMessage(process.env.TELEGRAM_USER_ID, `<b>[New Post]</b> - <i>from <a href="https://www.instagram.com/${item.user.username}">@${item.user.username}</a></i>\n` +
                            `Posted at : ${new Date(item.taken_at * 1000).toLocaleString('id', { dateStyle: 'full', timeStyle: 'long' })}\n` +
                            `Caption : ${item.caption.text}\n` +
                            `Media Count : ${item.carousel_media_count}`, { parse_mode: 'HTML' })

                        item.carousel_media.forEach(async (v, i, a) => {
                            if (v.media_type == 2) {
                                await bot.sendVideo(process.env.TELEGRAM_USER_ID, v.video_versions[0].url, { caption: `Media no: ${i + 1}` })
                            } else {
                                await bot.sendPhoto(process.env.TELEGRAM_USER_ID, v.image_versions2.candidates[0].url, { caption: `Media no: ${i + 1}` })
                            }
                        })
                    }
                } else if (push.collapseKey == 'direct_v2_delete_item') {
                    let user = await ig.user.info(push.sourceUserId);
                    console.log(color('[UNSENT DM]', 'red'), color(`${printDate}`, 'yellow'), '~ from =>', color(`[ ${user.username} ]`, 'cyan'));

                    const opts = {
                        caption: `<b>[Unsent DM]</b> - Deleted dm <i>from <a href="https://www.instagram.com/${user.username}">@${user.username}</a></i>\n`,
                        parse_mode: 'HTML'
                    }
                    await bot.sendMessage(process.env.TELEGRAM_USER_ID, opts.caption, { parse_mode: opts.parse_mode });
                }
            } catch (error) {
                console.log(error);
            }
        });

        ig.fbns.on('auth', async (auth) => {
            // console.log(auth)
            console.log(color('[AUTH]', 'red'), color(`${printDate}`, 'yellow'), 'Login Success.', color(`[ ${loggedUser.username} ]`, 'cyan'));
            console.log(color('[INFO]', 'cyan'), color(`${printDate}`, 'yellow'), 'Waiting for new user updates');
            const opts = {
                caption: `Logged In as ${loggedUser.username}, please follow target and turn on post/reel/stories notifications`,
            }
            await bot.sendMessage(process.env.TELEGRAM_USER_ID, opts.caption);
            await saveState(ig);
        });

        ig.fbns.on('error', async (err) => {
            console.log(color('[ERROR]', 'red'), err);
        });

        ig.fbns.on('warning', async (warning) => {
            console.log(color('[WARNING]', 'red'), warning);
        });

        ig.fbns.on('disconnect', async (dc) => {
            console.log(color('[ERROR]', 'red'), dc);
        });

        await ig.fbns.connect();
    } catch (error) {
        console.log(error);
    }
})()

/**
 * A wrapper function to log to the console
 * @param name
 * @returns {(data) => void}
 */
function logEvent(name) {
    return (data) => console.log(name, data);
}