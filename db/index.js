const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");
const { color } = require("../utils");

var db = new JsonDB(new Config("db/stories", true, true, '/'));

/**
 * delete expiried story id
 * @param {string} username 
 * @param {string} storyId 
 * @param {string} expiring 
 */
const deleteExpired = (username, storyId, expiring) => {
    const exists = db.getData(`/${username}`).filter(x => x.storyId === storyId)[0]
    if (exists !== undefined && Math.floor(Date.now() / 1000) >= exists.expiring) {
        const index = db.getIndex(`/${username}`, storyId, 'storyId')
        db.delete(`/${username}[${index}]`)
        console.log(color('[DB]', 'blue'), color('storyID Expiring :', 'red'), color(`[ ${username} ]`, 'cyan'), '-', color(storyId, 'yellow'));
    }
}

/**
 * add stori id to db
 * @param {string} username 
 * @param {string} storyId 
 * @param {number} expiring 
 */
const addStoryId = (username, storyId, expiring) => {
    let obj = { storyId, expiring }
    !db.exists(`/${username}`) ? db.push(`/${username}[]`, obj) : ''

    const list = db.getData(`/${username}`).some(x => x.storyId === storyId)
    if (!list) {
        db.push(`/${username}[]`, obj)
        console.log(color('[DB]', 'blue'), color('storyID Insert :', 'green'), color(`[ ${username} ]`, 'cyan'), '-', color(storyId, 'yellow'));
    } else {
        deleteExpired(username, storyId)
    }
}

/**
 * check story id exists on db
 * @param {string} username 
 * @param {string} storyId 
 * @returns true if stori id is on db
 */
const isExists = (username, storyId) => {
    const exists = db.exists(`/${username}`)//.filter(x => x.storyId === storyId)[0]
    if (exists) {
        const dbls = db.getData(`/${username}`).find(x => x.storyId === storyId)
        return dbls === undefined ? false : dbls.storyId === storyId
    } else {
        return false
    }
}

//console.log(isExists('gimenz.id', 'aaa'));
// db.delete('/gimenz.id[0]')

module.exports = {
    deleteExpired,
    addStoryId,
    isExists
}