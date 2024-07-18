const puppeteer = require('puppeteer');
// const WebSocket = require('ws');

async function buyTickets(ticketUrl, chatId, bot) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(ticketUrl);

    const selector = `.ticket-rates-action.plus`;
    await page.waitForSelector(selector, { visible: true });
    await page.click(selector);

    const nextButtonSelector = '.entry-tickets-stages-item-footer .button-primary[data-action="next-stage"]';
    await page.waitForSelector(nextButtonSelector, { visible: true });
    await page.click(nextButtonSelector);

    const payButtonSelector = '.button.button-primary[data-action="buy-button"]';
    await page.waitForSelector(payButtonSelector, { visible: true });
    await page.click(payButtonSelector);

    const kaspiPaymentSelector = '.payment-button[data-payment-system="kaspi"]';
    await page.waitForSelector(kaspiPaymentSelector, { visible: true });
    await page.click(kaspiPaymentSelector);

    await page.waitForSelector('input[name="phone"]', { visible: true });
    await page.type('input[name="phone"]', '476667965');
    await page.click('.auth-popup-send-code-button');

    await bot.sendMessage(chatId, 'Введите код, отправленный на ваш телефон:');

    // const userCode = await waitForUserInput(chatId);

    // await page.waitForSelector('input[name="code"]', { visible: true });
    // await page.type('input[name="code"]', userCode);
    // await page.click('.auth-popup-validate-button');

    await browser.close();
}

// async function waitForUserInput(chatId) {
//     return new Promise((resolve, reject) => {
//         const ws = new WebSocket(`ws://localhost:8080?chatId=${chatId}`);

//         ws.on('message', (message) => {
//             resolve(message);
//             ws.close();
//         });

//         ws.on('error', (error) => {
//             reject(error);
//         });
//     });
// }

export default buyTickets;