const { ok } = require('assert');
const { createHash } = require('crypto');
const chromium = require('chrome-aws-lambda');
const util = require('util')
const zlib = require('zlib')

const gzip = util.promisify(zlib.gzip)

exports.handler = async (event, context) => {
  let browser = null;

  try {
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const contexts = [
      browser.defaultBrowserContext(),
    ];

    while (contexts.length < event.length) {
      contexts.push(await browser.createIncognitoBrowserContext());
    }

    for (let context of contexts) {
      const job = event.shift();
      const page = await context.defaultPage();

      if (job.hasOwnProperty('url') === true) {
        await page.goto(job.url, { waitUntil: ['domcontentloaded', 'load'] });

        if (job.hasOwnProperty('expected') === true) {
          if (job.expected.hasOwnProperty('title') === true) {
            try {
              ok(await page.title() === job.expected.title, `Title assertion failed.`);
            } catch (e) {
              console.log('title', await page.title())
              throw e
            }
          }

          if (job.expected.hasOwnProperty('screenshot') === true) {
            const imgBase64 = (await page.screenshot()).toString('base64')
            const hash = createHash('sha1').update(imgBase64).digest('hex')
            try {
              ok(hash === job.expected.screenshot, `Screenshot assertion failed.`);
            } catch (e) {
              console.log('hash', hash)
              console.log('img', (await gzip(imgBase64)).toString('base64'))
              console.log('content', await page.content())
              throw e
            }
          }
        }
      }
    }
  } catch (error) {
    throw error.message;
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return true;
};
