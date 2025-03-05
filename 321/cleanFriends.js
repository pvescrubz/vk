const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware для парсинга JSON
app.use(express.json());

// Рут для статических файлов из папки public
app.use(express.static(path.join(__dirname, '../public')));

// Маршрут для /clean
app.get('/clean', (req, res) => {
    const filePath = path.join(__dirname, '../public/clean.html');
    res.sendFile(filePath);
});

// Маршрут для получения списка пользователей
app.post('/get-users', async (req, res) => {
    try {
        const { url } = req.body;

        // Извлечение токена из URL
        const match = url.match(/access_token=([^&]+)/);
        if (!match) {
            return res.status(400).json({ success: false, error: 'Токен не найден!' });
        }
        const token = match[1];

        // Получение списка "собачек"
        const doggies = await getDeactivatedFriends(token);

        // Получение списка заблокированных пользователей
        const banned = await getBannedUsers(token);

        // Форматируем данные для отправки
        const formattedDoggies = doggies.map(user => ({
            id: user.id,
            link: `https://vk.com/id${user.id}`
        }));

        const formattedBanned = banned.map(user => ({
            id: user.id,
            link: `https://vk.com/id${user.id}`
        }));

        res.json({
            success: true,
            doggies: formattedDoggies,
            banned: formattedBanned
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Произошла ошибка при получении данных.' });
    }
});

// Маршрут для очистки списков
app.post('/clear', async (req, res) => {
    try {
        const { url } = req.body;

        // Извлечение токена из URL
        const match = url.match(/access_token=([^&]+)/);
        if (!match) {
            return res.status(400).json({ success: false, error: 'Токен не найден!' });
        }
        const token = match[1];

        // Очистка черного списка
        const bannedResult = await clearBannedList(token);

        // Очистка "собачек" из друзей
        const friendsResult = await clearDeactivatedFriends(token);

        // Отправка результата клиенту
        res.json({
            success: true,
            message: `Черный список и друзья успешно очищены.\n${bannedResult}\n${friendsResult}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Произошла ошибка при обработке запроса.' });
    }
});

// Функция для получения списка заблокированных пользователей
async function getBannedUsers(token) {
    try {
        const response = await axios.get('https://api.vk.com/method/account.getBanned', {
            params: {
                access_token: token,
                v: '5.131'
            }
        });

        if (response.data.response && response.data.response.items) {
            // Фильтруем только пользователей с корректным ID
            return response.data.response.items.filter(user => user.id).map(user => ({
                id: user.id,
                link: `https://vk.com/id${user.id}`
            }));
        }

        return [];
    } catch (error) {
        console.error("Ошибка при получении списка заблокированных пользователей:", error.message);
        return [];
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Функция для получения списка "собачек"
async function getDeactivatedFriends(token) {
    try {
        const response = await axios.get('https://api.vk.com/method/friends.get', {
            params: {
                access_token: token,
                fields: 'deactivated',
                v: '5.131'
            }
        });

        if (response.data.response && response.data.response.items) {
            // Фильтруем только "собачек" и формируем ссылки
            return response.data.response.items
                .filter(friend => friend.deactivated && friend.id) // Проверяем наличие id
                .map(friend => ({
                    id: friend.id,
                    link: `https://vk.com/id${friend.id}`
                }));
        }

        return [];
    } catch (error) {
        console.error("Ошибка при получении списка друзей:", error.message);
        return [];
    }
}
// Функция для очистки черного списка
async function clearBannedList(token) {
    try {
        const response = await axios.get('https://api.vk.com/method/account.getBanned', {
            params: {
                access_token: token,
                v: '5.131'
            }
        });

        if (response.data.response && response.data.response.items) {
            const bannedUsers = response.data.response.items;

            let result = '';
            for (const user of bannedUsers) {
                const userId = user.id;
                if (!userId) continue;

                // Удаляем пользователя из черного списка
                const unbanResponse = await axios.get('https://api.vk.com/method/account.unbanUser', {
                    params: {
                        user_id: userId,
                        access_token: token,
                        v: '5.131'
                    }
                });

                if (unbanResponse.data.response === 1) {
                    result += `Пользователь [${userId}](https://vk.com/id${userId}) удален из черного списка.\n`;
                } else {
                    result += `Не удалось удалить пользователя ${userId} из черного списка.\n`;
                }

                // Добавляем задержку перед следующим запросом (например, 1 секунда)
                await sleep(1000); // Задержка в 1000 миллисекунд (1 секунда)
            }

            return result || 'Черный список пуст.';
        }

        return 'Не удалось получить список заблокированных пользователей.';
    } catch (error) {
        console.error("Ошибка при очистке черного списка:", error.message);
        return 'Ошибка при очистке черного списка.';
    }
}

// Функция для очистки "собачек" из друзей
async function clearDeactivatedFriends(token) {
    try {
        const response = await axios.get('https://api.vk.com/method/friends.get', {
            params: {
                access_token: token,
                fields: 'deactivated',
                v: '5.131'
            }
        });

        if (response.data.response && response.data.response.items) {
            const friends = response.data.response.items.filter(friend => friend.deactivated);

            let result = '';
            for (const friend of friends) {
                const userId = friend.id;
                if (!userId) continue;

                // Удаляем пользователя из друзей
                const deleteResponse = await axios.get('https://api.vk.com/method/friends.delete', {
                    params: {
                        user_id: userId,
                        access_token: token,
                        v: '5.131'
                    }
                });

                if (deleteResponse.data.response && deleteResponse.data.response.success === 1) {
                    result += `Пользователь [${userId}](https://vk.com/id${userId}) удален из друзей (статус: ${friend.deactivated}).\n`;
                } else {
                    result += `Не удалось удалить пользователя ${userId} из друзей.\n`;
                }

                // Добавляем задержку перед следующим запросом (например, 1 секунда)
                await sleep(500); // Задержка в 1000 миллисекунд (1 секунда)
            }

            return result || 'Нет собачек среди друзей.';
        }

        return 'Не удалось получить список друзей.';
    } catch (error) {
        console.error("Ошибка при очистке друзей:", error.message);
        return 'Ошибка при очистке друзей.';
    }
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});