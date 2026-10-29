# opencode-token-quota

Плагин для **OpenCode Desktop**: показывает расход токенов относительно лимита **15 000 000 / 4 часа** прямо в чате.

Бейдж рядом с полем ввода:

```text
560K/15M • 4%
```

По клику:

```text
Квота токенов (4 часа): 559,528 / 15,000,000 (4%).
Сессия: 559,528 токенов.
Осталось: 14,440,472
```

Также есть команда `/quota` и строка статуса в TUI.

## Требования

- Установленный **OpenCode Desktop 2.2+**
- Для ручной установки из Git — **Node.js 22+** и Git

---

## Установка на ноутбук (рекомендуется)

### Вариант A — одной командой OpenCode CLI

В терминале:

```bash
opencode plugin add github:Homavi88/opencode
```

Затем **полностью закройте и снова откройте** OpenCode Desktop.

Откройте любой чат — над полем ввода должен появиться бейдж `0/15M • 0%` (цифры вырастут после ответов модели). Проверка: введите `/quota`.

---

### Вариант B — вручную из GitHub (если CLI недоступен)

#### 1. Скачайте плагин

```bash
cd ~
git clone -b cursor/token-quota-desktop-caf9 https://github.com/Homavi88/opencode.git opencode-token-quota
cd opencode-token-quota
npm install
npm run build
```

Запомните путь к папке, например:

- macOS / Linux: `/Users/ВАШ_ЛОГИН/opencode-token-quota`
- Windows: `C:\Users\ВАШ_ЛОГИН\opencode-token-quota`

#### 2. Пропишите плагин в конфиге OpenCode

Откройте (или создайте) **глобальный** конфиг:

| ОС | Файл |
| --- | --- |
| macOS / Linux | `~/.config/opencode/opencode.jsonc` |
| Windows | `%USERPROFILE%\.config\opencode\opencode.jsonc` |

Вставьте (путь замените на свой):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/Users/ВАШ_ЛОГИН/opencode-token-quota",
      "options": {
        "limit": 15000000,
        "windowHours": 4,
        "locale": "ru"
      }
    }
  ]
}
```

На Windows в JSON пути используйте прямые слэши, например `"C:/Users/ВАШ_ЛОГИН/opencode-token-quota"`.

Если в файле уже есть другие плагины — **добавьте** этот объект в массив `plugins`, не удаляя остальные.

#### 3. Перезапустите OpenCode Desktop

Закройте приложение полностью и откройте снова. В сессии чата появится бейдж квоты.

---

### Вариант C — положить в папку plugins

```bash
mkdir -p ~/.config/opencode/plugins
cp -R ~/opencode-token-quota ~/.config/opencode/plugins/token-quota
```

Папки внутри `~/.config/opencode/plugins/` OpenCode подхватывает сам. После копирования всё равно нужен `npm install` и `npm run build` в этой папке, затем перезапуск Desktop.

---

## Как проверить, что всё работает

1. Открыть OpenCode Desktop → любая сессия.
2. Над composer виден бейдж вида `…/15M • …%`.
3. В чате набрать `/quota` — появится отчёт по квоте.
4. Settings → Extensions → Plugins — плагин `token-quota` в списке (для Desktop GUI).

## Опции

| Опция | По умолчанию | Описание |
| --- | --- | --- |
| `limit` | `15000000` | Лимит токенов в окне |
| `windowHours` | `4` | Длина окна в часах |
| `locale` | `"ru"` | `"ru"` или `"en"` |

## Как считается расход

Плагин слушает события завершения шагов модели (`session.step.ended`), суммирует  
`input + output + reasoning + cache.read + cache.write` и считает скользящее окно (по умолчанию 4 часа). История хранится в storage плагина.

## Разработка

```bash
npm install
npm test
npm run build
npm run build:watch
```

## Структура

- `src/index.ts` — server + RPC + `/quota`
- `src/gui.tsx` — бейдж в Desktop
- `src/tui.tsx` — статус в TUI
- `src/quota.ts` — логика окна
- `dist/gui-experimental.cjs` — собранный GUI для Desktop
