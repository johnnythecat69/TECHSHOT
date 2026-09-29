# Локальный генератор TechShot

Он запускает ComfyUI на ПК с NVIDIA GPU и принимает задания только от TechShot через защищённый токен. Сотрудникам не нужны ни ключи, ни учётные записи генератора.

## Что установить на ПК

1. В ComfyUI Desktop импортировать шаблон `Z-Image-Turbo: текст в изображение` и скачать его три модели: `qwen_3_4b.safetensors`, `z_image_turbo_bf16.safetensors`, `ae.safetensors`.
2. Для RTX 4060 8 ГБ добавить в **Manage → Startup Args** параметр `--disable-pinned-memory`, затем перезапустить экземпляр.
3. В отдельном PowerShell в этой папке выполнить:

```powershell
$env:TECHSHOT_GENERATOR_TOKEN = 'длинный-случайный-секрет-минимум-24-символа'
$env:COMFYUI_URL = 'http://127.0.0.1:8188'
node .\techshot-comfy-bridge.mjs
```

4. Проверить в браузере на ПК: `http://127.0.0.1:3333/health`.
5. Опубликовать порт `3333` через защищённый Cloudflare Tunnel или Tailscale Funnel. URL туннеля записать в Vercel как `COMFY_BRIDGE_URL`, а тот же секрет — как `COMFY_BRIDGE_TOKEN`.

Не открывайте сам ComfyUI в интернет: наружу публикуется только мост, который проверяет токен.

Мост ставит кадр в очередь и сразу возвращает идентификатор задачи. TechShot сам опрашивает статус, поэтому Vercel не обрывает генерацию, которая дольше минуты.
