const puppeteer = require('puppeteer');

const buyHallTicket = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://sxodim.com/almaty/kontserty/muzykalnyy-performans-uei-kueii-1/tickets'); // Замените URL на нужный адрес страницы

    // Получение значения data-id из элемента с классом 'tickets-hall-item'
    const dataId = await page.evaluate(() => {
        const element = document.querySelector('.tickets-hall-item');
        return element ? element.getAttribute('data-id') : null;
    });

    if (dataId) {
        console.log(`Значение data-id: ${dataId}`);
        
        const now = new Date();
        const formattedDate = `${("0" + now.getDate()).slice(-2)}.${("0" + (now.getMonth() + 1)).slice(-2)}.${now.getFullYear()}`; // Форматируем дату в формате DD.MM.YYYY
        const key = `hall-map-${dataId}-${formattedDate}`;
        
        // Устанавливаем значение в localStorage
        await page.evaluate((key) => {
            const value = JSON.stringify({ seats: [35686] });
            localStorage.setItem(key, value);
        }, key);

        console.log(`Ключ '${key}' был успешно добавлен в localStorage с форматом даты DD.MM.YYYY.`);
        
        await page.waitForSelector('.tickets-buy-btn-box', { visible: true });
        await page.click('.tickets-buy-btn-box');


        const kaspiPaymentSelector = '.payment-button[data-payment-system="kaspi"]';
        await page.waitForSelector(kaspiPaymentSelector, { visible: true });
        await page.click(kaspiPaymentSelector);


        await page.waitForSelector('input[name="phone"]', { visible: true });
        await page.type('input[name="phone"]', '772259177');
        await page.click('.auth-popup-send-code-button'); 
        
    } else {
        console.log("Не удалось найти элемент с data-id.");
    }

};

export default buyHallTicket;
