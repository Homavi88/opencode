# opencode-token-quota

Плагин для **OpenCode Desktop**, который показывает расход токенов относительно лимита **15 000 000 / 4 часа** прямо в чате — в виде бейджа рядом с composer:

```text
560K/15M • 4%
```

По клику открывается подробности (как во всплывающей подсказке):

```text
Квота токенов (4 часа): 559,528 / 15,000,000 (4%).
Сессия: 559,528 токенов.
Осталось: 14,440,472
```

Также работает в TUI (`prompt.footer.status`) и через slash-команду `/quota`.

## Требования

- OpenCode **2.2+** (Desktop с `gui-experimental`)
- Node.js **22+** только для сборки/тестов

## Установка

### 1. Локально из этого репозитория

```bash
npm install
npm run build
```

Добавьте плагин в глобальный `~/.config/opencode/opencode.json(c)` (чтобы Desktop подхватил GUI во всех окнах):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-token-quota",
      "options": {
        "limit": 15000000,
        "windowHours": 4,
        "locale": "ru"
      }
    }
  ]
}
```

Или скопируйте пакет в `~/.config/opencode/plugins/token-quota` / `.opencode/plugins/token-quota`.

### 2. Перезапустите OpenCode Desktop

В активной сессии над полем ввода появится бейдж квоты. Команда `/quota` печатает тот же отчёт в чат.

## Как считается расход

1. Серверная часть слушает `session.step.ended` и `session.usage.recorded`.
2. Суммирует `input + output + reasoning + cache.read + cache.write`.
3. Хранит события в plugin storage и считает **скользящее окно** (по умолчанию 4 часа).
4. GUI читает снимок через RPC и обновляет `ComposerPill` в чате.

## Опции

| Опция | По умолчанию | Описание |
| --- | --- | --- |
| `limit` | `15000000` | Лимит токенов в окне |
| `windowHours` | `4` | Длина окна в часах |
| `locale` | `"ru"` | `"ru"` или `"en"` для подписей |

## Разработка

```bash
npm install
npm test
npm run build
npm run build:watch   # hot-reload GUI в Desktop
```

## Структура

- `src/index.ts` — server plugin + RPC + `/quota`
- `src/gui.tsx` — Desktop `ComposerPill`
- `src/tui.tsx` — TUI status в prompt footer
- `src/quota.ts` — чистая логика окна и дедупликация
