require('dotenv').config()
const chalk = require('chalk');
const { promisify } = require('util')
const {
    writeFile,
    readFile,
    exists,
} = require('fs');
const { IgApiClient } = require('instagram-private-api');

const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const existsAsync = promisify(exists);
const { IG_USERNAME = '', IG_PASSWORD = '' } = process.env;

/**
 * Get text with color
 * @param  {String} text
 * @param  {String} color
 * @return  {String} Return text with color
 */
const color = (text, color) => {
    return !color ? chalk.green(text) : color.startsWith('#') ? chalk.hex(color)(text) : chalk.keyword(color)(text);
};

/**
 * coloring background
 * @param {string} text
 * @param {string} color
 * @returns
 */
function bgColor(text, color) {
    return !color
        ? chalk.bgGreen(text)
        : color.startsWith('#')
            ? chalk.bgHex(color)(text)
            : chalk.bgKeyword(color)(text);
}

/**
 * 
 * @param {IgApiClient} ig 
 * @returns 
 */
async function saveState(ig) {
    return writeFileAsync('state.json', await ig.exportState(), { encoding: 'utf8' });
}

/**
 * 
 * @param {IgApiClient} ig 
 * @returns 
 */
async function readState(ig) {
    if (!await existsAsync('state.json'))
        return;
    await ig.importState(await readFileAsync('state.json', { encoding: 'utf8' }));
}

/**
 * 
 * @param {IgApiClient} ig 
 * @returns 
 */
async function loginToInstagram(ig) {
    ig.request.end$.subscribe(() => saveState(ig));
    return await ig.account.login(IG_USERNAME, IG_PASSWORD);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    color,
    bgColor,
    saveState,
    readState,
    loginToInstagram,
    delay
}