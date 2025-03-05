const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Загружаем переменные окружения
const config = require('../config.json'); // Загружаем конфигурацию

// Путь к папке с профилями
const profilesDir = path.resolve(__dirname, '../Chrome_Profiles');

// Функция для создания нового профиля
async function createProfile() {
    try {
        // 1. Проверяем, существует ли папка Chrome_Profiles
        if (!fs.existsSync(profilesDir)) {
            console.log(`[+] Создаем папку для профилей: ${profilesDir}`);
            fs.mkdirSync(profilesDir);
        }

        // 2. Находим последний номер профиля
        const profileFolders = fs.readdirSync(profilesDir).filter(folder => folder.startsWith('profile'));
        const lastProfileNumber = profileFolders.length > 0
            ? Math.max(...profileFolders.map(folder => parseInt(folder.replace('profile', ''), 10)))
            : 0;

        const newProfileNumber = lastProfileNumber + 1;
        const newProfileName = `profile${newProfileNumber}`;
        const newProfilePath = path.resolve(profilesDir, newProfileName);

        console.log(`[+] Создаем новый профиль: ${newProfileName}`);
        console.log(`[+] Путь к новому профилю: ${newProfilePath}`);

        // 3. Запускаем браузер с новым профилем
        const browser = await puppeteer.launch({
            headless: config.headlessMode, // Режим headless из конфига
            args: [
                `--user-data-dir=${newProfilePath}`, // Указываем путь к новому профилю
                '--disable-blink-features=AutomationControlled', // Отключаем флаг автоматизации
                '--no-sandbox',
                '--disable-setuid-sandbox',
                config.proxy ? `--proxy-server=${config.proxy}` : null // Прокси из конфига
            ].filter(Boolean)
        });

        const page = await browser.newPage();

        // Эмуляция реального браузера
        const userAgent = config.userAgents[Math.floor(Math.random() * config.userAgents.length)];
        await page.setUserAgent(userAgent);
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });

        // 4. Переходим на страницу входа ВКонтакте
        console.log(`[+] Переходим на страницу входа ВКонтакте...`);
        await page.goto('https://vk.com/login', { waitUntil: 'networkidle2' });

        // 5. Ждем ручного входа
        console.log(`[+] Пожалуйста, выполните вход вручную...`);
        await page.waitForSelector('.TopNavBtn__profileImg', { timeout: 300000 }); // Ждем появления кнопки профиля (5 минут)

        console.log(`[+] Авторизация успешна для профиля: ${newProfileName}`);

        // 6. Закрываем браузер
        await browser.close();
        console.log(`[+] Браузер закрыт для профиля: ${newProfileName}`);
    } catch (error) {
        console.error('[!] Ошибка при создании профиля:', error);
    }
}

// Функция форматирования времени
function formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Пример использования
(async () => {
    await createProfile();
})();