const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Используем библиотеку form-data

// Функция для написания поста с прикреплением файлов
async function writePost(token, ownerId, message, attachments) {
    try {
        if (!ownerId) {
            throw new Error('Не указан owner_id.');
        }

        // Преобразуем массив объектов в строку для API ВКонтакте
        const attachmentsString = attachments
            .map(item => `${item.type}${item[item.type].owner_id}_${item[item.type].id}`)
            .join(',');

        const response = await axios.post('https://api.vk.com/method/wall.post', null, {
            params: {
                access_token: token,
                owner_id: ownerId,
                message: message,
                attachments: attachmentsString,
                v: '5.131'
            }
        });

        if (response.data.response && response.data.response.post_id) {
            const postId = response.data.response.post_id;
            const postUrl = `https://vk.com/wall${ownerId}_${postId}`;
            return { success: true, postId, postUrl };
        } else {
            return { success: false, message: 'Ошибка при создании поста' };
        }
    } catch (error) {
        console.error('Ошибка при создании поста:', error.message || error);
        return { success: false, message: error.message || 'Ошибка при запросе к API VK' };
    }
}

// Функция для загрузки фото
async function uploadPhotoToVK(token, ownerId, filePath) {
    try {
        // Шаг 1: Получаем URL для загрузки фото
        const uploadServerResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
            params: {
                access_token: token,
                v: '5.131'
            }
        });

        if (!uploadServerResponse.data.response || !uploadServerResponse.data.response.upload_url) {
            throw new Error('Не удалось получить upload_url для фото.');
        }

        const uploadUrl = uploadServerResponse.data.response.upload_url;

        // Шаг 2: Загружаем фото на полученный URL
        const form = new FormData();
        form.append('photo', fs.createReadStream(filePath));

        const uploadResponse = await axios.post(uploadUrl, form, {
            headers: form.getHeaders()
        });

        const { server, photo, hash } = uploadResponse.data;

        // Шаг 3: Сохраняем фото
        const saveResponse = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
            params: {
                access_token: token,
                user_id: ownerId,
                server: server,
                photo: photo,
                hash: hash,
                v: '5.131'
            }
        });

        const savedPhoto = saveResponse.data.response[0];
        return {
            type: 'photo',
            photo: {
                id: savedPhoto.id,
                owner_id: savedPhoto.owner_id,
                access_key: savedPhoto.access_key
            }
        };
    } catch (error) {
        console.error('Ошибка при загрузке фото:', error.message || error);
        return null; // Возвращаем null, если загрузка не удалась
    }
}
// Функция для загрузки видео
async function uploadVideoToVK(token, ownerId, filePath) {
    try {
        // Шаг 1: Получаем URL для загрузки видео
        const uploadResponse = await axios.get('https://api.vk.com/method/video.save', {
            params: {
                access_token: token,
                name: 'Uploaded video',
                description: 'Video uploaded via API',
                wallpost: 0,
                v: '5.131'
            }
        });

        if (!uploadResponse.data.response || !uploadResponse.data.response.upload_url) {
            throw new Error('Не удалось получить upload_url для видео.');
        }

        const uploadUrl = uploadResponse.data.response.upload_url;

        // Шаг 2: Загружаем видео на полученный URL
        const form = new FormData();
        form.append('video_file', fs.createReadStream(filePath));

        const videoResponse = await axios.post(uploadUrl, form, {
            headers: form.getHeaders()
        });

        const { owner_id, video_id } = videoResponse.data;

        // Шаг 3: Дожидаемся завершения обработки видео
        const isProcessed = await waitForVideoProcessing(token, owner_id, video_id);
        if (!isProcessed) {
            throw new Error('Видео не прошло обработку.');
        }

        return {
            type: 'video',
            video: {
                id: video_id,
                owner_id: owner_id
            }
        };
    } catch (error) {
        console.error('Ошибка при загрузке видео:', error.message || error);
        return null; // Возвращаем null, если загрузка не удалась
    }
}
// Функция для проверки статуса видео
async function waitForVideoProcessing(token, ownerId, videoId) {
    const maxAttempts = 10; // Максимальное количество попыток
    const delay = 5000; // Задержка между попытками (5 секунд)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await axios.get('https://api.vk.com/method/video.get', {
                params: {
                    access_token: token,
                    owner_id: ownerId,
                    videos: `${ownerId}_${videoId}`,
                    v: '5.131'
                }
            });

            const video = response.data.response.items[0];
            if (video && video.player) {
                console.log(`Видео ${ownerId}_${videoId} готово к использованию.`);
                return true;
            }
            console.log(`Видео ${ownerId}_${videoId} еще обрабатывается. Попытка ${attempt}/${maxAttempts}...`);
        } catch (error) {
            console.error(`Ошибка при проверке статуса видео: ${error.message || error}`);
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // Ждем перед следующей попыткой
    }

    console.error(`Видео ${ownerId}_${videoId} не прошло обработку за ${maxAttempts} попыток.`);
    return false;
}

module.exports = { writePost, uploadPhotoToVK, uploadVideoToVK };