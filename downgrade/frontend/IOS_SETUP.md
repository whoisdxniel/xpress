# iOS setup (copia downgrade)

Esta carpeta es la copia aislada pensada para intentar exportar iOS desde una Mac vieja.

- Ruta correcta para iOS downgrade: `downgrade/frontend/`
- El proyecto original `frontend/` no se toca y sigue en Expo SDK 54 + React Native 0.81.
- Esta copia quedo fijada en Expo SDK 48 + React Native 0.71.14 + React 18.2.0.

## Estado actual de esta copia

- `npx expo config --json`: OK
- `npm run typecheck`: OK
- Realtime foreground por Socket.IO: activo
- Sonidos foreground: activos
- Push iOS: pausado por defecto
- Tracking de ubicacion en background para chofer: mantenido

## Objetivo de toolchain

Esta copia se preparo para intentar compilar con:

- macOS Big Sur 11.7.11
- Xcode 13.2.1

No pude validar el build nativo iOS en este entorno porque estoy trabajando en Windows. Lo que si quedo validado es la consistencia del proyecto Expo/TypeScript dentro de `downgrade/frontend/`.

## Archivos y credenciales

### Frontend downgrade

- `GoogleService-Info.plist`:
  - opcional mientras el push iOS siga pausado
  - si lo quieres usar, colocalo en `downgrade/frontend/GoogleService-Info.plist`

- Mapbox:
  - runtime: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
  - build nativo iOS: `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`
  - si ya usas `MAPBOX_DOWNLOADS_TOKEN`, `app.config.js` lo reutiliza

### Backend

- Android sigue usando FCM con `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH`
- iOS no registra push remoto salvo que definas `EXPO_PUBLIC_IOS_PUSH_ENABLED=1`

## Flujo recomendado en la Mac

1. Abrir terminal dentro de `downgrade/frontend/`.
2. Ejecutar `npm install`.
3. Exportar `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` y `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.
4. Ejecutar `npx expo prebuild --clean --platform ios`.
5. Entrar a `ios/` y ejecutar `pod install`.
6. Abrir `ios/*.xcworkspace` en Xcode 13.2.1 o ejecutar `npx expo run:ios --device`.
7. Si compila en dispositivo, usar Xcode para Archive y exportar el IPA.

## Notas importantes

- Para iOS downgrade, no uses `frontend/`; usa siempre `downgrade/frontend/`.
- El archivo `rnmapbox.app.plugin.js` es intencional en esta copia. Se dejo asi para que Expo 48 resuelva bien el plugin de `@rnmapbox/maps`.
- Esta copia ya no depende de `gap` incompatible con RN 0.70 porque se subio a RN 0.71 dentro del mismo downgrade.
- En esta iteracion, iOS no intenta registrar push remoto salvo que definas `EXPO_PUBLIC_IOS_PUSH_ENABLED=1`.
- Sin APNs no hay equivalencia con Android cuando la app esta cerrada; el objetivo actual sigue siendo foreground realtime estable.
- Push remoto iOS no funciona en simulator; prueba en iPhone fisico.
- El chofer debe aceptar permiso `Always` para que el tracking en segundo plano funcione bien.
- El bundle identifier actual esperado por la app es `com.xpress.traslados`.