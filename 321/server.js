const path = require('path');
const axios = require('axios'); // Импортируем axios
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Указываем путь к .env
const express = require('express');
const multer = require('multer');
const fs = require('fs'); // Импортируем fs
const { writePost, uploadPhotoToVK, uploadVideoToVK } = require('./vk-api');
const app = express();

// Middleware для парсинга JSON
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public'))); // Статические файлы

// Настройки multer для сохранения файлов с оригинальными расширениями
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads/')); // Путь к папке uploads
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage }); // Используем обновленную конфигурацию

// Маршрут для создания репостов
app.post('/send-repost', async (req, res) => {
    try {
      const { token, comment, link } = req.body;
  
      // Логируем полученные данные
      console.log('Полученные данные:', req.body);
  
      if (!token || !comment || !link) {
        console.error('Ошибка: Отсутствует token, comment или link');
        return res.status(400).json({ success: false, error: 'Token, comment and link are required' });
      }
  
      // Извлекаем wall<owner_id>_<post_id> из ссылки
      try {
        const url = new URL(link);
        const pathParts = url.pathname.split('/');
        const object = pathParts[1]; // wall-227983663_244 или wall1024636450_78
  
        if (!/^wall-\d+_\d+$/.test(object) && !/^wall\d+_\d+$/.test(object)) {
          console.error(`Ошибка: Некорректный формат ссылки: ${link}`);
          return res.status(400).json({ success: false, error: 'Некорректный формат ссылки. Ожидалась ссылка вида https://vk.com/wall<owner_id>_<post_id>' });
        }
  
        console.log(`Извлечено object: ${object}`);
  
        // Вызов API ВКонтакте для создания репоста
        const response = await axios.get('https://api.vk.com/method/wall.repost', {
          params: {
            access_token: token,
            object: object, // wall-227983663_244 или wall1024636450_78
            message: comment, // Текст комментария
            v: '5.131',
          },
        });
  
        console.log('Ответ от API ВКонтакте:', response.data);
  
        const success = response.data.response.success === 1;
        const postId = response.data.response.post_id; // ID новой записи
        const postUrl = success ? `https://vk.com/wall${response.data.response.owner_id}_${postId}` : null;
  
        res.json({ success, postUrl });
      } catch (error) {
        console.error(`Ошибка при обработке ссылки ${link}:`, error.message);
        res.status(400).json({ success: false, error: 'Некорректный формат ссылки' });
      }
    } catch (error) {
      console.error('Глобальная ошибка:', error.message);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });
  
  
  // Маршрут для получения последней записи со стены пользователя
app.post('/get-last-post', async (req, res) => {
    try {
      const { token } = req.body;
  
      if (!token) {
        console.error('Ошибка: Отсутствует token');
        return res.status(400).json({ success: false, error: 'Token is required' });
      }
  
      // Вызов API ВКонтакте для получения записей со стены
      const response = await axios.get('https://api.vk.com/method/wall.get', {
        params: {
          access_token: token,
          owner_id: null, // Если null, то берется стена пользователя, связанного с токеном
          count: 1, // Получаем только одну запись (последнюю)
          filter: 'owner', // Только записи владельца стены
          v: '5.131',
        },
      });
  
      console.log('Ответ от API ВКонтакте (wall.get):', response.data);
  
      const posts = response.data.response.items;
      if (posts.length === 0) {
        return res.status(404).json({ success: false, error: 'Записи не найдены' });
      }
  
      const lastPost = posts[0];
      const ownerId = lastPost.owner_id;
      const postId = lastPost.id;
      const postUrl = `https://vk.com/wall${ownerId}_${postId}`;
  
      res.json({ success: true, postUrl });
    } catch (error) {
      console.error('Ошибка при вызове wall.get:', error.message);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });
  
app.post('/send-posts', upload.array('files'), async (req, res) => {
    const tokensJson = req.body.tokens;
    const postsJson = req.body.posts;
    const files = req.files;

    if (!tokensJson || !postsJson) {
        return res.status(400).json({ error: 'Заполните оба поля' });
    }

    let tokensData;
    let postsData;

    try {
        // Парсим токены
        tokensData = JSON.parse(tokensJson);

        // Проверяем формат JSON для постов
        const parsedPosts = JSON.parse(postsJson);
        if (Array.isArray(parsedPosts)) {
            if (parsedPosts.every(post => typeof post === 'string')) {
                // Если массив строк, преобразуем его в объекты с полем "text"
                postsData = parsedPosts.map(text => ({ text }));
            } else if (parsedPosts.every(post => typeof post === 'object' && post.text)) {
                // Если массив объектов с полем "text", используем его как есть
                postsData = parsedPosts;
            } else {
                throw new Error('Некорректный формат JSON для постов');
            }
        } else {
            throw new Error('JSON для постов должен быть массивом');
        }
    } catch (error) {
        return res.status(400).json({ error: `Ошибка при разборе JSON: ${error.message}` });
    }

    const results = [];

    // Распределяем посты между пользователями
    for (let i = 0; i < Math.min(tokensData.length, postsData.length); i++) {
        const token = tokensData[i];
        const post = postsData[i];

        try {
            // Получаем ID пользователя через токен
            const userInfo = await getUserInfo(token);
            const ownerId = userInfo.id;

            let attachments = [];

            if (files && files.length > 0) {
                for (const file of files) {
                    const ext = path.extname(file.originalname).toLowerCase();
                    let attachment = null;

                    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                        attachment = await uploadPhotoToVK(token, ownerId, file.path);
                    } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
                        attachment = await uploadVideoToVK(token, ownerId, file.path);
                    } else {
                        console.error(`Неподдерживаемый формат файла: ${file.originalname}`);
                    }

                    if (attachment) {
                        attachments.push(attachment);
                    } else {
                        fs.unlinkSync(file.path); // Удаляем файл, если загрузка не удалась
                    }
                }
            }

            // Отправляем пост с текстом и прикрепленными файлами
            const result = await writePost(token, ownerId, post.text, attachments);

            if (result.success) {
                console.log(`Пост с ID ${result.postId} успешно опубликован.`);
            } else {
                console.error(`Ошибка при публикации поста: ${result.message}`);
            }
            results.push(result);
        } catch (error) {
            console.error(`Ошибка при работе с токеном: ${error.message || error}`);
            results.push({ success: false, message: error.message || 'Ошибка при публикации' });
        }
    }

    // Возвращаем результаты в формате JSON
    res.json(results.map(result => ({
        success: result.success,
        postId: result.postId,
        postUrl: result.postUrl
    })));
});
// Маршрут для получения списка пользователей
app.get('/fetch-users', async (req, res) => {
    const tokensJson = Object.entries(process.env)
        .filter(([key]) => key.startsWith('TOKEN_'))
        .map(([, value]) => value);

    console.log('Загруженные токены:', tokensJson);

    if (tokensJson.length === 0) {
        return res.status(400).json({ error: 'Токены не найдены в .env файле' });
    }

    const users = [];

    for (const token of tokensJson) {
        try {
            const userInfo = await getUserInfo(token);
            users.push({ ...userInfo, token });
        } catch (error) {
            console.error(`Не удалось получить информацию о пользователе: ${error.message || error}`);
        }
    }

    res.json(users);
});

// Функция для получения информации о пользователе
async function getUserInfo(token) {
    try {
        const response = await axios.get('https://api.vk.com/method/users.get', {
            params: {
                access_token: token,
                v: '5.131'
            }
        });

        console.log('Ответ от API VK:', response.data);

        if (!response.data.response || !Array.isArray(response.data.response) || response.data.response.length === 0) {
            throw new Error('Некорректный ответ от API VK');
        }

        const user = response.data.response[0];
        return { id: user.id, firstName: user.first_name, lastName: user.last_name };
    } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error.message || error);
        throw error;
    }
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});