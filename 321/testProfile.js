const puppeteer = require('puppeteer');
const path = require('path');
const config = require('../config.json'); // Загружаем конфигурацию

// Путь к папке с профилями
const profilesDir = path.resolve(__dirname, '../Chrome_Profiles');

// Функция для входа в ВКонтакте с использованием профиля
async function loginWithProfile(profileName) {
    const profilePath = path.resolve(profilesDir, profileName); // Путь к профилю

    console.log(`[+] Запускаем Puppeteer с профилем: ${profileName}`);
    console.log(`[+] Путь к профилю: ${profilePath}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: config.headlessMode, // Режим headless из конфига
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Путь к Chrome на macOS
            args: [
                `--user-data-dir=${profilePath}`, // Указываем путь к профилю
                '--disable-blink-features=AutomationControlled', // Отключаем флаг автоматизации
                '--no-sandbox',
                '--disable-setuid-sandbox',
                config.proxy ? `--proxy-server=${config.proxy}` : null // Прокси из конфига
            ].filter(Boolean)
        });

        const page = await browser.newPage();

        // Переходим на страницу ВКонтакте
        console.log('[+] Переходим на страницу ВКонтакте...');
        await page.goto('https://vk.com/feed', { waitUntil: 'networkidle2' });

        // Проверяем, успешно ли выполнен вход
        console.log('[+] Проверяем авторизацию...');
        const profileButton = await page.$('.TopNavBtn__profileImg'); // Ищем кнопку профиля
        if (profileButton) {
            console.log('[+] Авторизация успешна.');
        } else {
            console.log('[!] Авторизация не удалась.');
        }

        // Ждем 10 секунд, чтобы вы могли увидеть результат
        await new Promise(resolve => setTimeout(resolve, 10000));

        await browser.close(); // Закрываем браузер
        console.log('[+] Браузер закрыт.');
    } catch (error) {
        console.error('[!] Ошибка:', error);
    }
}

// Пример использования
(async () => {
    const profileName = 'profile2'; // Укажите имя профиля, который хотите использовать
    await loginWithProfile(profileName);
})();