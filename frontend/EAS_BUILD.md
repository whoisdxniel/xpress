# Build APK local (Android)

Este proyecto ya no usa EAS para generar APK. El flujo recomendado es compilar localmente con Gradle.

## Requisitos
- Windows + Android Studio instalado.
- Node.js (para `npm install`).

## 1) Configurar URL del backend
La app lee el backend desde `EXPO_PUBLIC_API_BASE_URL` (debe incluir `/api`).

Opcional:
- `EXPO_PUBLIC_OSRM_BASE_URL` (por defecto usa `https://router.project-osrm.org`).

En `frontend/.env` podés definir, por ejemplo:
- `EXPO_PUBLIC_API_BASE_URL=https://xpress-production-e5d4.up.railway.app/api`

## 2) Instalar Android SDK (una sola vez)
Desde `frontend/`:
- `npm run android:setup-sdk`

Esto descarga `commandline-tools`, acepta licencias e instala:
- `platform-tools`
- `platforms;android-36`
- `build-tools;36.0.0`
- `ndk;27.1.12297006`

## 3) Generar APK debug
Desde `frontend/`:
- `npm run android:apk`

Salida esperada:
- `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Notas
- Usá HTTPS en producción (Android suele bloquear HTTP plano).
- Si el build pide componentes extra (por ejemplo CMake), Gradle los descargará automáticamente.

## Push notifications (Android)
Esta app registra el token nativo (FCM) con `expo-notifications` y el backend envía por Firebase Admin.

Para que las push funcionen en el APK:
- Crear un proyecto Firebase con el package `com.xpress.traslados`.
- Descargar `google-services.json` y colocarlo en `frontend/google-services.json`.
- Configurar el backend (Railway) con `FCM_SERVICE_ACCOUNT_JSON` (service account de Firebase).
