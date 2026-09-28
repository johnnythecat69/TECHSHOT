# Локальный генератор TechShot

Он запускает ComfyUI на ПК с NVIDIA GPU и принимает задания только от TechShot через защищённый токен. Сотрудникам не нужны ни ключи, ни учётные записи генератора.

## Что установить на ПК

1. Установить ComfyUI для Windows и скачать SDXL checkpoint `sd_xl_base_1.0.safetensors` в `ComfyUI/models/checkpoints/`.
2. Запустить ComfyUI в режиме низкой видеопамяти: `python main.py --listen 127.0.0.1 --lowvram`.
3. В отдельном PowerShell в этой папке выполнить:

```powershell
$env:TECHSHOT_GENERATOR_TOKEN = 'длинный-случайный-секрет-минимум-24-символа'
$env:COMFYUI_URL = 'http://127.0.0.1:8188'
$env:TECHSHOT_CHECKPOINT = 'sd_xl_base_1.0.safetensors'
node .\techshot-comfy-bridge.mjs
```

4. Проверить в браузере на ПК: `http://127.0.0.1:3333/health`.
5. Опубликовать порт `3333` через защищённый Cloudflare Tunnel или Tailscale Funnel. URL туннеля записать в Vercel как `COMFY_BRIDGE_URL`, а тот же секрет — как `COMFY_BRIDGE_TOKEN`.

Не открывайте сам ComfyUI в интернет: наружу публикуется только мост, который проверяет токен.
