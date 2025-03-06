const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const config = require('../config.json'); // Загружаем конфигурацию

// Путь к папке с профилями
const profilesDir = path.resolve(__dirname, '../Chrome_Profiles');

// Функция для получения последних записей из паблика через API
async function getLatestPostsFromAPI(accessToken, ownerId, count = 10) {
    try {
        const response = await axios.get('https://api.vk.com/method/wall.get', {
            params: {
                access_token: accessToken,
                owner_id: ownerId,
                count: count,
                filter: 'owner',
                v: '5.131'
            }
        });

        // Проверяем структуру ответа
        if (!response.data.response || !Array.isArray(response.data.response.items)) {
            console.error(`[${formatTimestamp(new Date())}] Некорректный ответ API:`, response.data);
            return [];
        }

        // Фильтруем посты с видео
        const posts = response.data.response.items.filter(post => post.attachments?.some(att => att.type === 'video'));

        // Формируем массив ссылок на видео (включая клипы)
        const videoLinks = posts.map(post => {
            const video = post.attachments.find(att => att.type === 'video')?.video;
            if (video) {
                return {
                    clipUrl: `https://vk.com/club${Math.abs(video.owner_id)}?z=clip${video.owner_id}_${video.id}`,
                    videoUrl: `https://vk.com/video${video.owner_id}_${video.id}`
                };
            }
            return null;
        }).filter(link => link); // Убираем null значения

        console.log(`[${formatTimestamp(new Date())}] Найдено ${posts.length} постов с видео.`);
        console.log(`[${formatTimestamp(new Date())}] Ссылки на видео:`);
        videoLinks.forEach((link, index) => {
            console.log(`[${index + 1}] Клип: ${link.clipUrl}`);
            console.log(`     Видео: ${link.videoUrl}`);
        });

        return posts;
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка при получении постов через API:`, error.response ? error.response.data : error.message);
        return [];
    }
}

// Функция для получения информации о видео через API
async function getVideoInfo(accessToken, videoId) {
    try {
        const response = await axios.get('https://api.vk.com/method/video.get', {
            params: {
                access_token: accessToken,
                videos: videoId,
                v: '5.131'
            }
        });

        const video = response.data.response.items[0];

        return {
            id: video.id,
            owner_id: video.owner_id,
            title: video.title,
            views: video.views,
            duration: video.duration // Добавляем длительность видео
        };
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка при получении информации о видео ${videoId}:`, error.response ? error.response.data : error.message);
        return null;
    }
}

// Функция для имитации просмотра видео
async function watchVideo(page, videoUrl, videoDuration) {
    try {
        console.log(`[${formatTimestamp(new Date())}] Переходим к видео: ${videoUrl}`);
        await page.goto(videoUrl, { waitUntil: 'load', timeout: 60000 });

        // Имитируем просмотр видео в течение его длительностиno
        const watchTime = videoDuration * 1000; // Переводим длительность в миллисекунды
        console.log(`[${formatTimestamp(new Date())}] Смотрю видео (${videoUrl}) в течение ${videoDuration} секунд...`);
        await new Promise(resolve => setTimeout(resolve, watchTime)); // Ждем полную длительность видео

        console.log(`[${formatTimestamp(new Date())}] Просмотр завершен.`);
        return true;
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка при просмотре видео ${videoUrl}:`, error);
        return false;
    }
}

// Функция для отправки уведомлений в Telegram
async function sendTelegramMessage(message) {
    try {
        const { chatId, botToken } = config.telegram;
        console.log(`[${formatTimestamp(new Date())}] Отправляем уведомление в Telegram: ${message}`);
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message
        });
        console.log(`[${formatTimestamp(new Date())}] Уведомление отправлено в Telegram.`);
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка при отправке уведомления в Telegram:`, error.response ? error.response.data : error.message);
    }
}

// Функция форматирования времени
function formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Функция для получения рандомного токена из .env
function getRandomToken() {
    const tokens = [];
    for (let i = 1; process.env[`TOKEN_${i}`]; i++) {
        tokens.push(process.env[`TOKEN_${i}`]);
    }
    if (tokens.length === 0) {
        throw new Error('Нет доступных токенов в .env файле.');
    }
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
}

// Функция для генерации случайной задержки
function getRandomDelay(min = 5000, max = 15000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Основная функция
async function WatchVideos()
     {
    const ownerId = '-229000453'; // ID паблика (замените на нужный)

    // Находим все профили в папке Chrome_Profiles
    const profileFolders = fs.readdirSync(profilesDir).filter(folder => folder.startsWith('profile'));
    console.log(`[${formatTimestamp(new Date())}] Найдено ${profileFolders.length} профилей.`);

    for (const profileName of profileFolders) {
        const profilePath = path.resolve(profilesDir, profileName); // Путь к профилю
        console.log(`[${formatTimestamp(new Date())}] Запускаем браузер для профиля: ${profileName}`);
        console.log(`[${formatTimestamp(new Date())}] Путь к профилю: ${profilePath}`);

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

            console.log(`[${formatTimestamp(new Date())}] Браузер запущен для профиля: ${profileName}`);

            const page = await browser.newPage();

            // Эмуляция реального браузера
            const userAgent = config.userAgents[Math.floor(Math.random() * config.userAgents.length)];
            await page.setUserAgent(userAgent);
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            console.log(`[${formatTimestamp(new Date())}] Эмуляция реального браузера для профиля: ${profileName}`);

            // Получаем рандомный токен
            const accessToken = getRandomToken();

            // Получаем последние посты с видео
            const posts = await getLatestPostsFromAPI(accessToken, ownerId);

            for (const post of posts) {
                const videoId = `${post.attachments[0].video.owner_id}_${post.attachments[0].video.id}`;
                const clipUrl = `https://vk.com/club${Math.abs(post.attachments[0].video.owner_id)}?z=clip${post.attachments[0].video.owner_id}_${post.attachments[0].video.id}`;
                console.log(`[${formatTimestamp(new Date())}] Обрабатываем клип: ${clipUrl}`);

                // Получаем информацию о видео до просмотра
                const videoInfoBefore = await getVideoInfo(accessToken, videoId);
                if (!videoInfoBefore) continue;

                console.log(`[${formatTimestamp(new Date())}] Количество просмотров до: ${videoInfoBefore.views}`);

                // Имитируем просмотр клипа
                const isSuccess = await watchVideo(page, clipUrl, videoInfoBefore.duration);

                // Получаем информацию о видео после просмотра
                const videoInfoAfter = await getVideoInfo(accessToken, videoId);
                if (!videoInfoAfter) continue;

                console.log(`[${formatTimestamp(new Date())}] Количество просмотров после: ${videoInfoAfter.views}`);

                if (videoInfoAfter.views > videoInfoBefore.views) {
                    await sendTelegramMessage(`[${profileName}] Просмотр засчитан: ${clipUrl}`);
                } else {
                    await sendTelegramMessage(`[${profileName}] Просмотр не засчитан: ${clipUrl}`);
                }

                // Добавляем случайную задержку перед следующим просмотром
                const delay = getRandomDelay(5000, 15000); // От 5 до 15 секунд
                console.log(`[${formatTimestamp(new Date())}] Ждем ${delay / 1000} секунд перед следующим просмотром...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            console.error(`[${formatTimestamp(new Date())}] Ошибка для профиля ${profileName}:`, error);
        } finally {
            if (browser) {
                await browser.close(); // Закрываем браузер
                console.log(`[${formatTimestamp(new Date())}] Браузер закрыт для профиля: ${profileName}`);
            }
        }
    }

    console.log('[+] Все профили завершили работу.');
    console.log('перезапускаю');
    startAgain();
}


function startAgain () {
    WatchVideos();
}

