# Build APK con EAS (Expo)

## Requisitos
- Tener cuenta en Expo.
- Instalar EAS CLI: `npm i -g eas-cli`

## 1) Configurar URL del backend
Tu app lee el backend desde `EXPO_PUBLIC_API_BASE_URL` (debe incluir `/api`).

Para ruteo, también podés configurar `EXPO_PUBLIC_OSRM_BASE_URL` (opcional; por defecto usa `https://router.project-osrm.org`).

Opciones:
- Editar `eas.json` y reemplazar los placeholders:
  - `EXPO_PUBLIC_API_BASE_URL` (ej: `http://TU_IP_LAN:3001/api` en LAN o `https://TU_DOMINIO/api` en producción)
  - `EXPO_PUBLIC_OSRM_BASE_URL` (si querés tu propio OSRM)
- O usar secrets (recomendado):
  - `eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://TU_DOMINIO/api`
  - (opcional) `eas secret:create --name EXPO_PUBLIC_OSRM_BASE_URL --value https://router.project-osrm.org`

## 2) Inicializar EAS
Desde `frontend/`:
- `eas login`
- `eas init`

> `eas init` suele escribir `extra.eas.projectId` en el config. Si te lo agrega, commitealo.

## 3) Generar APK
Desde `frontend/`:
- APK de pruebas (internal): `eas build -p android --profile preview`
- APK release: `eas build -p android --profile production`

Al finalizar, EAS te da un link para descargar el APK.

## Notas
- Usá HTTPS en producción (Android suele bloquear HTTP plano).
- Si cambiás `android.package` en `app.json`, EAS lo toma como una app distinta.

## Push notifications (Android)
Esta app registra el token nativo (FCM) con `expo-notifications` y el backend envía por Firebase Admin.

Para que las push funcionen en el APK:
- Crear un proyecto Firebase con el package `com.xpress.traslados`.
- Descargar `google-services.json` y colocarlo en `frontend/google-services.json`.
- Configurar el backend (Railway) con `FCM_SERVICE_ACCOUNT_JSON` (service account de Firebase).
