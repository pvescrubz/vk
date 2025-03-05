const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const express = require('express');

// Настройки VK
//-229000453 
const OWNER_ID = '-229000453'; // ID паблика (отрицательное число)
const POST_COUNT = 10; // Количество последних постов для проверки
const INTERVAL = 5 * 1000; // Интервал между запусками (5 секунд)

// Настройки Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Токен вашего бота
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // ID чата

// Получаем токены из переменных окружения
const ACCESS_TOKENS = [
    process.env.TOKEN_1,
    process.env.TOKEN_2,
    process.env.TOKEN_3,
    process.env.TOKEN_4,
    process.env.TOKEN_5,
    process.env.TOKEN_6,
    process.env.TOKEN_7,
    process.env.TOKEN_8,
    process.env.TOKEN_9,
    process.env.TOKEN_10,
    process.env.TOKEN_11,
    process.env.TOKEN_12,
    process.env.TOKEN_13,
    process.env.TOKEN_14,
    process.env.TOKEN_15,
    process.env.TOKEN_16,
    process.env.TOKEN_17,
    process.env.TOKEN_18,
    process.env.TOKEN_19,
    process.env.TOKEN_20
];

// Функция для добавления задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для отправки сообщения в Telegram
async function sendToTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log(`[${formatTimestamp(new Date())}] Сообщение отправлено в Telegram: ${message}`);
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка при отправке в Telegram:`, error);
    }
}

// Функция для получения последних постов
async function getPosts(ownerId, count) {
    const response = await axios.get('https://api.vk.com/method/wall.get', {
        params: {
            access_token: ACCESS_TOKENS[0], // Используем первый токен для получения постов
            owner_id: ownerId,
            count: count,
            filter: 'owner',
            v: '5.131'
        }
    });
    if (!response.data.response || !Array.isArray(response.data.response.items)) {
        throw new Error('Некорректный ответ от API VK');
    }
    return response.data.response.items;
}

// Функция для проверки, лайкнут ли пост
async function isLiked(token, ownerId, postId) {
    const response = await axios.get('https://api.vk.com/method/likes.isLiked', {
        params: {
            access_token: token,
            type: 'post',
            owner_id: ownerId,
            item_id: postId,
            v: '5.131'
        }
    });
    return response.data.response.liked === 1;
}

// Функция для простановки лайка
async function addLike(token, ownerId, postId) {
    const response = await axios.get('https://api.vk.com/method/likes.add', {
        params: {
            access_token: token,
            type: 'post',
            owner_id: ownerId,
            item_id: postId,
            v: '5.131'
        }
    });
    return response.data;
}

// Функция для получения имени пользователя
async function getUserInfo(token) {
    const response = await axios.get('https://api.vk.com/method/users.get', {
        params: {
            access_token: token,
            v: '5.131'
        }
    });
    const user = response.data.response[0];
    return `${user.first_name} ${user.last_name}`;
}

// Функция для форматирования времени в формате "25.10.1995 17:01"
function formatTimestamp(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Флаг для предотвращения дублирования
let isRunning = false;

// Основная логика скрипта
async function runScript() {
    if (isRunning) {
        console.log(`[${formatTimestamp(new Date())}] Скрипт уже выполняется. Пропускаем запуск.`);
        return;
    }
    try {
        isRunning = true; // Блокируем повторный запуск
        console.log(`[${formatTimestamp(new Date())}] Начинаю выполнение скрипта...`);
        await sendToTelegram('Начинаю выполнение скрипта...');
        
        const posts = await getPosts(OWNER_ID, POST_COUNT);

        for (const post of posts) {
            const postId = post.id;
            const postUrl = `https://vk.com/wall${OWNER_ID}_${postId}`;

            // Проверяем, лайкнут ли пост каждым аккаунтом
            for (const token of ACCESS_TOKENS) {
                const userInfo = await getUserInfo(token);
                const isPostLiked = await isLiked(token, OWNER_ID, postId);

                if (!isPostLiked) {
                    // Ставим лайк
                    await addLike(token, OWNER_ID, postId);
                    const message = `Пост (${postUrl}) - Лайк поставлен - ID (${userInfo})`;
                    console.log(`[${formatTimestamp(new Date())}] ${message}`);
                    await sendToTelegram(message); // Отправляем сообщение в Telegram
                }

                // Добавляем задержку 1000мс (1 секунда)
                await delay(4500);
            }
        }

        console.log(`[${formatTimestamp(new Date())}] Скрипт завершил выполнение.`);
        await sendToTelegram('Скрипт завершил выполнение.');
    } catch (error) {
        console.error(`[${formatTimestamp(new Date())}] Ошибка:`, error);
        await sendToTelegram(`Ошибка: ${error.message}`);
    } finally {
        isRunning = false; // Снимаем блокировку после завершения
    }
}

// Создаем Express-приложение
const app = express();

// Маршрут для ручного запуска скрипта
app.get('/run', async (req, res) => {
    if (isRunning) {
        return res.status(400).send('Скрипт уже выполняется. Пожалуйста, подождите.');
    }
    try {
        await runScript();
        res.send('Скрипт успешно выполнен!');
    } catch (error) {
        res.status(500).send('Произошла ошибка при выполнении скрипта.');
    }
});

// Запускаем скрипт каждые 2 минуты
setInterval(runScript, INTERVAL);

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});