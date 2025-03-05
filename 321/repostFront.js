document.addEventListener('DOMContentLoaded',function() { 

// Элементы второй части приложения
const tokensInputReposts = document.getElementById("tokensContainerReposts");
const repostLinksInput = document.getElementById("repostLinks");
const submitRepostButton = document.getElementById("submitRepostButton");
const progressBarReposts = document.getElementById("progressBarReposts");
const progressTextReposts = document.getElementById("progressTextReposts");
const progressDivReposts = document.getElementById("progress-reposts");
const resultDivReposts = document.getElementById("result-reposts");
const linksListReposts = document.getElementById("linksListReposts");
const loaderReposts = document.getElementById("loader-reposts");

// Функции для работы с лоадером
function showLoaderReposts() {
  loaderReposts.style.display = "flex";
}

function hideLoaderReposts() {
  loaderReposts.style.display = "none";
}

// Загрузка пользователей для репостов
window.addEventListener("load", () => {
  fetchUsersForReposts();
});

async function fetchUsersForReposts() {
  showLoaderReposts(); // Показываем лоадер
  try {
    const response = await fetch('/fetch-users', { method: 'GET' });
    if (response.ok) {
      const users = await response.json();
      tokensInputReposts.innerHTML = ''; // Очищаем контейнер
      const groupSize = 10;
      for (let i = 0; i < users.length; i += groupSize) {
        const group = users.slice(i, i + groupSize);
        const titleGroup = document.createElement('p');
        let groupname = `${Math.floor(i / groupSize) + 1}`;
        if (groupname === "2") {
          groupname = "Курлов Урод";
        }
        titleGroup.textContent = groupname;
        tokensInputReposts.appendChild(titleGroup);
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('group');
        group.forEach(user => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = user.token;
          checkbox.id = `user-repost-${user.id}`;
          checkbox.checked = false;
          const label = document.createElement('label');
          label.htmlFor = `user-repost-${user.id}`;
          label.textContent = `${user.firstName} ${user.lastName} (${user.id})`;
          const div = document.createElement('div');
          div.appendChild(checkbox);
          div.appendChild(label);
          groupDiv.appendChild(div);
        });
        tokensInputReposts.appendChild(groupDiv);
      }
    } else {
      console.error('Ошибка при получении пользователей:', await response.text());
    }
  } catch (error) {
    console.error('Ошибка сети:', error.message || error);
  } finally {
    hideLoaderReposts(); // Скрываем лоадер
  }
}

// Обработка формы репостов
document.getElementById("repostForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  // Получаем выбранные аккаунты
  const selectedTokens = [];
  const checkboxes = tokensInputReposts.querySelectorAll('input[type="checkbox"]:checked');
  checkboxes.forEach((checkbox) => {
    selectedTokens.push(checkbox.value);
  });

  if (selectedTokens.length === 0) {
    alert("Пожалуйста, выберите хотя бы один аккаунт.");
    return;
  }

  // Получаем JSON с описаниями
  const repostLinksJson = repostLinksInput.value.trim();
  if (!repostLinksJson) {
    alert("Введите данные для репостов.");
    return;
  }

  try {
    const repostLinksData = JSON.parse(repostLinksJson);

    // Блокируем кнопку и показываем прогресс-бар
    submitRepostButton.disabled = true;
    submitRepostButton.innerText = "Создание репостов...";
    progressDivReposts.style.display = "flex";
    showLoaderReposts();

    // Отправляем репосты
    const results = [];
    for (let i = 0; i < repostLinksData.length; i++) {
      const description = repostLinksData[i].description;

      for (const token of selectedTokens) {
        try {
          const response = await fetch('/send-repost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, message: description }),
          });

          const data = await response.json();
          if (data.success) {
            results.push({ success: true, postUrl: data.postUrl });
          } else {
            results.push({ success: false, error: data.error });
          }
        } catch (error) {
          results.push({ success: false, error: error.message || "Ошибка сети" });
        }

        // Обновляем прогресс-бар
        const progress = ((i * selectedTokens.length + results.length) / (repostLinksData.length * selectedTokens.length)) * 100;
        progressBarReposts.value = progress;
        progressTextReposts.innerText = `${Math.round(progress)}%`;
      }
    }

    // Отображаем результаты
    linksListReposts.innerHTML = "";
    results.forEach((result) => {
      const li = document.createElement("li");
      if (result.success) {
        const link = document.createElement("a");
        link.href = result.postUrl;
        link.target = "_blank";
        link.innerText = result.postUrl;
        li.appendChild(link);
      } else {
        li.innerText = `Ошибка: ${result.error}`;
      }
      linksListReposts.appendChild(li);
    });

    resultDivReposts.innerText = "Репосты завершены.";
  } catch (error) {
    alert('Некорректный формат JSON в поле "Ссылки для репостов".');
  } finally {
    // Разблокируем кнопку и скрываем прогресс-бар
    submitRepostButton.disabled = false;
    submitRepostButton.innerText = "Создать репосты";
    progressDivReposts.style.display = "none";
    hideLoaderReposts();
  }
});

})