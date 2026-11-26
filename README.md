# Encuesta de horario de reuniones · Congregación El Río, Panajachel

Dashboard con los resultados en vivo de la encuesta de cambio de horario.

| Reunión | Horario actual | Horario nuevo |
|---|---|---|
| Entre semana | Jueves 7:00 p.m. | Miércoles 6:30 p.m. |
| Fin de semana | Sábado 6:00 p.m. | Domingo 9:00 a.m. |

## Cómo funciona

```
KoboToolbox  →  Google Sheets (Apps Script, cada 10 min)  →  URL /exec  →  index.html (cada 5 min)
```

## Archivos

- `index.html`: el dashboard. Es un solo archivo, sin instalar nada.
- `apps-script/kobo-encuesta-horarios.gs`: código de Apps Script que trae los datos de Kobo a la hoja de Google y los entrega al dashboard.

## Publicar en GitHub Pages

1. Sube `index.html` a la raíz del repositorio.
2. Entra a **Settings → Pages**.
3. En **Source** elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y presiona **Save**.
4. Espera unos minutos. La página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

## Configuración (al inicio del `<script>` en `index.html`)

| Variable | Para qué sirve |
|---|---|
| `DEFAULT_URL` | URL `/exec` de la aplicación web de Apps Script |
| `META_RESPUESTAS` | Cuántas personas se espera que respondan. Con `0` no se muestra el % de participación |
| `REFRESH_MIN` | Cada cuántos minutos se revisan los datos (por defecto 5) |

## Opciones en la dirección

- `?meta=90`: muestra la participación con una meta de 90 personas, sin editar el archivo.
- `?ejemplo`: muestra datos de ejemplo.
- `?admin`: muestra las herramientas ocultas, para cargar un CSV o conectar otra URL.

## Qué muestra

- Total de respuestas y participación (si hay meta).
- Hora de la última respuesta.
- Resultado de cada reunión: % nuevo contra % actual, con aviso si la diferencia es pequeña.
- Combinaciones: los dos nuevos, solo uno o los dos actuales.
- Respuestas por día.
- Botones para **Actualizar**, **Presentar** (pantalla completa, letra grande) e **Imprimir/PDF**.

> Nota: si el repositorio es público, cualquiera con el enlace puede ver los resultados (solo el horario preferido, sin nombres). El token de Kobo **nunca** va en este repositorio: se guarda en las Propiedades del script de Apps Script.
