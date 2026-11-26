/***** =====================================================================
   ENCUESTA DE HORARIO DE REUNIONES – CONGREGACIÓN EL RÍO, PANAJACHEL
   Kobo  →  Google Sheets  →  dashboard-encuesta-horarios.html
   ===================================================================== *****/

/***** ============ CONFIGURACIÓN ============ *****/
const KOBO_BASE  = "https://kf.kobotoolbox.org";   // Servidor Kobo
const ASSET_UID  = "aUK9ZV8oQfKGoR7BHHrzPD";         // ID del formulario de la ENCUESTA
const SHEET_NAME = "kobo_data";                    // Pestaña donde se guardan las respuestas

/***** ============ ETIQUETAS QUE ESPERA EL DASHBOARD ============ *****
   Kobo entrega nombres técnicos (pref_semana) y códigos (actual / nuevo).
   El dashboard muestra lo que diga la fila 1 y el texto de cada celda,
   así que aquí se traducen a texto legible.
   Si cambias el formulario, el script intenta leer las etiquetas
   directamente de Kobo; este mapa es el respaldo.
   ***************************************************************/
const HEADER_MAP = {
  pref_semana: "¿Qué horario prefiere para la reunión de entre semana?",
  pref_finde:  "¿Qué horario prefiere para la reunión del fin de semana?"
};
const CHOICE_MAP = {
  pref_semana: { actual: "Jueves 7:00 p.m. (actual)", nuevo: "Miércoles 6:30 p.m. (nuevo)" },
  pref_finde:  { actual: "Sábado 6:00 p.m. (actual)", nuevo: "Domingo 9:00 a.m. (nuevo)" }
};
// Columnas técnicas que también se guardan (el dashboard las ignora)
const EXTRA_COLS = ["_id", "_submission_time"];

/***** ============ TOKEN ============ *****
   El token NO va escrito en el código. Corre configurarToken() una vez
   (menú 🔄 Datos Kobo → 1) y queda guardado en las Propiedades del script.
   ***************************************************************/
function configurarToken() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    "Token de API de KoboToolbox",
    "Pega aquí tu token. Se guarda de forma privada en este proyecto, nunca en el código visible.",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const token = resp.getResponseText().trim();
  if (!token) { ui.alert("No escribiste ningún token."); return; }
  PropertiesService.getScriptProperties().setProperty("KOBO_TOKEN", token);
  ui.alert("✅ Token guardado.");
}

function getKoboToken_() {
  const token = PropertiesService.getScriptProperties().getProperty("KOBO_TOKEN");
  if (!token) throw new Error('Falta configurar el token. Corre primero "configurarToken".');
  return token.trim();
}

/***** ============ MENÚ ============ *****/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔄 Datos Kobo")
    .addItem("1) Configurar token (una sola vez)", "configurarToken")
    .addItem("2) Traer datos ahora", "loadKoboData")
    .addSeparator()
    .addItem("Activar actualización automática (cada 10 min)", "programarActualizacion")
    .addItem("Desactivar actualización automática", "quitarActualizacion")
    .addToUi();
}

/***** ============ HTTP ============ *****/
function fetchJson_(url, token) {
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Token " + token, Accept: "application/json" },
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  if (code !== 200) throw new Error(`HTTP ${code} en ${url}\nRespuesta:\n${body.slice(0, 300)}`);
  return JSON.parse(body);
}

function shortName_(k) {
  const parts = String(k || "").split("/");
  return parts[parts.length - 1];
}

function labelText_(lab) {
  if (lab == null) return "";
  if (Array.isArray(lab)) return lab.length ? labelText_(lab[0]) : "";
  if (typeof lab === "object") return String(lab.text || lab.label || Object.values(lab).find(v => typeof v === "string") || "");
  return String(lab);
}

/***** ============ ETIQUETAS DESDE KOBO (con respaldo) ============ *****/
function getLabels_(token) {
  const headers = Object.assign({}, HEADER_MAP);
  const choices = JSON.parse(JSON.stringify(CHOICE_MAP));
  try {
    const asset = fetchJson_(`${KOBO_BASE}/api/v2/assets/${ASSET_UID}/`, token);
    const content = asset.content || {};
    const byList = {};
    (content.choices || []).forEach(c => {
      if (!c || !c.list_name) return;
      (byList[c.list_name] = byList[c.list_name] || {})[c.name] = labelText_(c.label);
    });
    (content.survey || []).forEach(q => {
      if (!q || !q.name || !/^select_/.test(q.type || "")) return;
      if (q.label) headers[q.name] = labelText_(q.label);
      const list = q.select_from_list_name || String(q.type).split(" ")[1];
      if (byList[list]) choices[q.name] = byList[list];
    });
  } catch (e) {
    Logger.log("No se pudieron leer las etiquetas de Kobo, se usa el mapa fijo: " + e.message);
  }
  return { headers, choices };
}

/***** ============ DESCARGA Y ESCRITURA ============ *****/
function loadKoboData() {
  const token = getKoboToken_();
  const { headers: H, choices: C } = getLabels_(token);

  let url = `${KOBO_BASE}/api/v2/assets/${ASSET_UID}/data.json?page_size=1000`;
  const all = [];
  while (url) {
    const page = fetchJson_(url, token);
    if (Array.isArray(page.results)) all.push.apply(all, page.results);
    url = page.next || null;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.clear();

  const questions = Object.keys(H);               // pref_semana, pref_finde, …
  const header = EXTRA_COLS.concat(questions.map(q => H[q]));
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  if (all.length) {
    const rows = all.map(r => {
      // Kobo puede entregar "g_semana/pref_semana": se busca por nombre corto
      const flat = {};
      Object.keys(r).forEach(k => { flat[shortName_(k)] = r[k]; });
      const extra = EXTRA_COLS.map(c => flat[c] == null ? "" : String(flat[c]));
      const answers = questions.map(q => {
        const v = flat[q];
        if (v == null || v === "") return "";
        const map = C[q] || {};
        return String(v).split(" ").map(code => map[code] || code).join(", ");
      });
      return extra.concat(answers);
    });
    const rango = sheet.getRange(2, 1, rows.length, header.length);
    rango.setNumberFormat("@");
    rango.setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
  PropertiesService.getScriptProperties().setProperty("ULTIMA_ACTUALIZACION", new Date().toISOString());
}

/***** ============ CONEXIÓN EN VIVO CON EL DASHBOARD ============ *****
   CÓMO ACTIVARLO (una sola vez):
   1) Implementar → Nueva implementación → tipo "Aplicación web".
   2) Ejecutar como: Yo.   Quién tiene acceso: Cualquier usuario.
   3) Copia la URL que termina en "/exec" y pégala en el dashboard → 🔗 Conectar.
   4) Si cambias este código: Implementar → Gestionar implementaciones →
      Editar → Nueva versión (así se mantiene la misma URL).
   La URL solo muestra el horario preferido de cada respuesta (sin nombres).
   ***************************************************************/
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = [];
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    for (let r = 1; r < data.length; r++) {
      if (data[r].every(c => c === "" || c === null)) continue;
      const obj = {};
      headers.forEach((h, i) => {
        let v = data[r][i];
        if (v instanceof Date) v = v.toISOString();
        obj[h] = v == null ? "" : v;
      });
      rows.push(obj);
    }
  }
  const out = {
    actualizado: PropertiesService.getScriptProperties().getProperty("ULTIMA_ACTUALIZACION") || "",
    datos: rows
  };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/***** ============ ACTUALIZACIÓN AUTOMÁTICA ============ *****/
function programarActualizacion() {
  quitarActualizacion_();
  ScriptApp.newTrigger("loadKoboData").timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert("✅ Los datos se traerán de Kobo cada 10 minutos.");
}
function quitarActualizacion() {
  quitarActualizacion_();
  SpreadsheetApp.getUi().alert("Actualización automática desactivada.");
}
function quitarActualizacion_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "loadKoboData")
    .forEach(t => ScriptApp.deleteTrigger(t));
}
