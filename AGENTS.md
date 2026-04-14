# Overview
`astro-tech-blog` — это статический сайт `cherkashin.dev` на `Astro + MDX + React + Tailwind`.
Telegram pipeline для экспорта, конвертации и синхронизации постов существует отдельно и не должен смешиваться с runtime-кодом сайта.

# Structure
```text
.
├── src/
│   ├── pages/                 # Маршруты и контент сайта
│   │   ├── articles/          # Длинные редакционные MDX-материалы
│   │   ├── demos/             # Демо-страницы и эксперименты
│   │   ├── posts/             # Посты из Telegram pipeline
│   │   └── tags/              # Навигация и маршруты тегов
│   ├── components/            # Переиспользуемые UI-компоненты
│   ├── layouts/               # Astro layouts
│   └── utils/                 # Вспомогательная логика контента и сборки
├── public/                    # Публичные медиа и статические ассеты
├── scripts/                   # Служебные скрипты, включая Telegram pipeline
├── tests/                     # Node-based тесты утилит и преобразований
├── .telegram-export/          # Промежуточные артефакты Telegram-экспорта
└── docs/                      # Проектная документация
```

- Новый контент, маршруты и страницы размещай в подходящем разделе `src/pages/...`.
- Новые разделы внутри `src/pages` добавляй только осознанно и сразу отражай в `AGENTS.md`.
- Медиа, изображения, видео и прочие публичные файлы держи в `public/...`.
- Telegram pipeline и прочую служебную логику держи в `scripts/...`, отдельно от runtime-кода сайта.
- Не перемещай контент хаотично между `articles`, `posts`, `demos` и `tags`.

# Content And Styling Rules
- Используй Tailwind utility-классы как основной способ стилизации.
- Не добавляй новые CSS-файлы и handcrafted styling без отдельного согласования.
- Для исходного markdown используй `rawContent()`.
- Для HTML-результата используй `compiledContent()`.
- Для plain-text preview, описаний и RSS используй `buildTextPreview()`.

# Commands
```bash
npm install
npm run dev
npm run build
npm run test
npm run preview
```

# Boundaries
MUST:
- Соблюдай текущую структуру директорий и размещай код и контент в подходящих разделах проекта.
- Обновляй `AGENTS.md`, если меняются ключевые директории, подпапки `src/pages` или рабочие команды.

ASK:
- Спрашивай перед добавлением новых зависимостей.
- Спрашивай перед изменением Telegram pipeline или его рабочих сценариев.
- Спрашивай перед добавлением новых верхнеуровневых разделов сайта, изменением публичных URL или `redirects`.
- Спрашивай перед крупной перестройкой структуры контента в `articles`, `posts`, `demos` или `tags`.

NEVER:
- Не добавляй handcrafted CSS и новые CSS-файлы без отдельного согласования.
- Не смешивай Telegram pipeline и другую служебную логику с runtime-кодом сайта.
- Не перемещай контент хаотично между `articles`, `posts`, `demos` и `tags`.
