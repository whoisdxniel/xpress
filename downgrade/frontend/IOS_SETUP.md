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

## Preparacion recomendada en Mac vieja

En macOS Big Sur, `brew install node@18` y `brew install cocoapods` pueden intentar compilar dependencias pesadas y quedarse mucho tiempo en `make`, especialmente durante `python@3.13` o `python@3.14`.

Ruta recomendada para evitar ese bloqueo:

1. Instalar la app completa de Xcode 13.2.1 y ejecutar:
  - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
  - `sudo xcodebuild -license accept`
  - `sudo xcodebuild -runFirstLaunch`
2. No depender de Homebrew para Node en esa Mac si se queda atascado.
3. Usar el instalador oficial `.pkg` de Node 18. Si Safari o la Mac no terminan la descarga, bajar el `.pkg` desde otra PC y copiarlo a la Mac por USB, Drive o red local.
4. Verificar luego con `node -v` y confirmar que quede en `18.x`.
5. Instalar CocoaPods con RubyGems en lugar de Homebrew:
   - en esta Mac, primero instalar la gema binaria compatible de `ffi` para evitar compilar extensiones nativas:
     - `sudo gem install ffi -v 1.17.2 --no-document`
   - luego fijar `zeitwerk` en la ultima rama compatible con Ruby 2.6 para que `activesupport 6.1` no intente bajar una version que ya pide Ruby 3.2:
     - `sudo gem install zeitwerk -v 2.6.18 --no-document`
   - luego fijar `activesupport` en una rama compatible con Ruby 2.6 para que RubyGems no suba a dependencias modernas que piden `securerandom` para Ruby 3:
     - `sudo gem install activesupport -v 6.1.7.10 --no-document`
   - si al ejecutar `pod --version` aparece `uninitialized constant ActiveSupport::LoggerThreadSafeLevel::Logger`, primero probar cargando `logger` explicitamente en el proceso Ruby de CocoaPods:
     - `export RUBYOPT=-rlogger`
     - `pod --version`
   - si prefieres fijarlo tambien del lado de gemas, bajar `concurrent-ruby` a la ultima version que sigue cargando `logger` implicitamente:
     - `sudo gem uninstall concurrent-ruby -v 1.3.5 -aIx`
     - `sudo gem install concurrent-ruby -v 1.3.4 --no-document`
   - luego instalar CocoaPods sin intentar subir dependencias ya resueltas:
     - `sudo gem install cocoapods -v 1.15.2 --conservative --no-document`
6. Recien despues continuar con `npm install` dentro de `downgrade/frontend/`.

Si `ffi 1.17.2` no entra como binaria o RubyGems vuelve a intentar compilarla, usar este plan B:

1. `sudo rm -rf /Library/Developer/CommandLineTools`
2. `xcode-select --install`
3. Al terminar, volver a apuntar a Xcode:
  - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
  - `sudo xcodebuild -runFirstLaunch`
4. Verificar compilador:
  - `clang --version`
  - `xcrun --find clang`
5. Reintentar `ffi` forzando la variante source solo como fallback:
  - `sudo gem install ffi -v 1.15.5 --platform=ruby --no-document -- --enable-system-libffi`
6. Fijar `zeitwerk` en una version compatible con Ruby 2.6:
  - `sudo gem install zeitwerk -v 2.6.18 --no-document`
7. Fijar `activesupport` en una version compatible con Ruby 2.6:
  - `sudo gem install activesupport -v 6.1.7.10 --no-document`
8. Si `pod --version` falla con `uninitialized constant ActiveSupport::LoggerThreadSafeLevel::Logger`, cargar `logger` explicitamente antes de seguir:
  - `export RUBYOPT=-rlogger`
  - `pod --version`
9. Si quieres dejar ademas el pin de gemas en una rama vieja compatible, bajar `concurrent-ruby` antes de seguir:
  - `sudo gem uninstall concurrent-ruby -v 1.3.5 -aIx`
  - `sudo gem install concurrent-ruby -v 1.3.4 --no-document`
10. Instalar CocoaPods sin actualizar `ffi`:
  - `sudo gem install cocoapods -v 1.15.2 --conservative --no-document`
11. Si el error menciona `securerandom`, probar primero:
  - `sudo gem install securerandom -v 0.3.2 --no-document`
  - y volver a ejecutar el comando de `cocoapods`
12. Si `cocoapods 1.15.2` sigue fallando en esa Mac, usar fallback estable para este proyecto:
  - `sudo gem install cocoapods -v 1.14.3 --conservative --no-document`

## Archivos y credenciales

### Frontend downgrade

- `GoogleService-Info.plist`:
  - opcional mientras el push iOS siga pausado
  - si lo quieres usar, colocalo en `downgrade/frontend/GoogleService-Info.plist`

- Mapbox:
  - runtime: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
  - build nativo iOS: `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`
  - si ya usas `MAPBOX_DOWNLOADS_TOKEN`, `app.config.js` lo reutiliza
  - `app.config.js` tambien copia el token runtime y otros `EXPO_PUBLIC_*` relevantes a `expo.extra`, para que el dev client y el archive no dependan solo de `process.env`
  - `app.config.js` tambien carga `.env`/`.env.local` directamente y escribe el token runtime en `Info.plist` (`MBXAccessToken` / `MGLMapboxAccessToken`) para que Mapbox iOS lo tenga disponible antes de que arranque el JS

### Backend

- Android sigue usando FCM con `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH`
- iOS no registra push remoto salvo que definas `EXPO_PUBLIC_IOS_PUSH_ENABLED=1`

## Flujo recomendado en la Mac

1. Dejar funcionando `node -v` en version `18.x`.
2. Abrir terminal dentro de `downgrade/frontend/`.
3. Ejecutar `npm install`.
  - esta copia aplica en `postinstall` un parche automatico al `boost.podspec` de React Native para evitar el checksum roto del mirror viejo de JFrog durante `pod install`.
  - esta copia ya trae `index.js` versionado, asi que Expo no deberia volver a reescribir `package.json` en cada `prebuild`.
  - en la Mac vieja, ese mismo `postinstall` tambien fija `Turf` en `2.6.1` dentro del podspec local de `@rnmapbox/maps` para evitar el error de link con `Swift.Sendable` al compilar simulador en Xcode 13.
  - ese mismo `postinstall` tambien parchea `expo-modules-core` para reemplazar dos usos de la palabra clave `any` que Swift 5.5 de Xcode 13.2.1 no soporta.
  - ese mismo `postinstall` tambien parchea RNMapbox iOS para dos compatibilidades extra de Xcode 13: evita el uso del existencial `any Layer` en Swift 5.5 y ajusta `PuckBearing` a `PuckBearingSource` cuando la copia downgrade usa Mapbox iOS `10.13.1`.
  - ese mismo `postinstall` tambien corrige dos fallos extra de compilacion de RNMapbox en Xcode 13: cambia `setBaseOptions<T: Layer>` a una variante compatible con `Layer` existencial en `RNMBXLayer.swift` y tipa explicitamente `buildLineString` en `RNMBXChangeLineOffsetsShapeAnimatorModule.swift` para que Swift 5.5 no falle infiriendo cierres complejos.
4. Exportar `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` y `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.
5. Antes de ejecutar `expo prebuild`, exportar `RUBYOPT=-rlogger` en esa misma terminal para que Expo pueda detectar correctamente `pod` y no intente reinstalar CocoaPods por gem o Homebrew.
6. Ejecutar `npx expo prebuild --clean --platform ios`.
7. Entrar a `ios/` y ejecutar `pod install`.
8. Abrir `ios/*.xcworkspace` en Xcode 13.2.1 o ejecutar `npx expo run:ios --device`.
9. Si compila en dispositivo, usar Xcode para Archive y exportar el IPA.
10. Si cambias `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` u otro `EXPO_PUBLIC_*`, reinicia Metro y vuelve a compilar la app para que `process.env` y `expo.extra` queden sincronizados.

## Notas importantes

- Para iOS downgrade, no uses `frontend/`; usa siempre `downgrade/frontend/`.
- El archivo `rnmapbox.app.plugin.js` es intencional en esta copia. Se dejo asi para que Expo 48 resuelva bien el plugin de `@rnmapbox/maps`.
- En esta copia, `rnmapbox.app.plugin.js` fija Mapbox nativo en `10.13.1` para iOS porque `11.16.x` ya exige Xcode 16.2 y no entra en la Mac vieja con Xcode 13.2.1.
- Esta copia tambien parchea en `postinstall` el `boost.podspec` de React Native para cambiar el download de `boost` al mirror oficial `archives.boost.io`, porque el mirror viejo de JFrog esta devolviendo un archivo con checksum incorrecto.
- Esta copia tambien versiona `index.js` y usa `main: index.js` para evitar que `expo prebuild` ensucie `package.json` en cada corrida.
- Esta copia tambien fija `Turf` en `2.6.1` dentro del podspec local de RNMapbox, porque `Turf 2.7.1+` introduce cambios de `Sendable` y `Turf 2.8.0` ya sube el minimo a Xcode 14.1, lo que rompe el simulador Intel con Xcode 13.2.1.
- Esta copia tambien parchea `expo-modules-core` en `DynamicType.swift` y `DynamicEnumType.swift` para quitar la palabra clave `any`, porque esa sintaxis recien aparece en Swift mas nuevo que el incluido en Xcode 13.2.1.
- Esta copia tambien parchea RNMapbox iOS en `RNMBXMapView.swift` y `RNMBXNativeUserLocation.swift`, porque la rama actual de `@rnmapbox/maps 10.2.10` todavia trae codigo pensado para Swift mas nuevo y para `PuckBearing` de Mapbox 11, mientras que esta copia downgrade fija Mapbox iOS `10.13.1`.
- Esta copia tambien parchea RNMapbox iOS en `RNMBXLayer.swift` y `RNMBXChangeLineOffsetsShapeAnimatorModule.swift` para evitar dos errores tipicos de Xcode 13: `Protocol 'Layer' as a type cannot conform to the protocol itself` y `Unable to infer complex closure return type`.
- Si bajas cambios que toquen `rnmapbox.app.plugin.js` o el `postinstall` iOS, no alcanza con repetir `pod install` sobre una carpeta `ios/` vieja: vuelve a correr `npx expo prebuild --clean --platform ios` para regenerar Podfile, flags y settings nativos antes de abrir Xcode.
- Esta copia carga un polyfill local de `URLSearchParams` desde el entrypoint para cubrir el runtime JS viejo de Expo 48 / RN 0.71 en iOS y evitar fallos como `URLSearchParams.set is not implemented`.
- Si el token runtime de Mapbox responde `401/403`, el wrapper `AppMap` cae automaticamente a un estilo raster abierto para que el simulador y las pantallas sigan funcionando mientras corriges el token publico; el routing ya intenta Mapbox primero y luego OSRM.
- En esta copia, `runtime.ts` tambien consulta los `EXPO_PUBLIC_*` con acceso estatico para que Expo 48 los incruste en el bundle JS; con acceso dinamico tipo `process.env[key]` Expo no siempre los expone en bare iOS.
- El fallback raster abierto ahora limita el zoom efectivo a `19` y agrega `User-Agent` solo para `tile.openstreetmap.org`, para evitar errores `400` al acercar demasiado en simulator.
- Esta copia ya no depende de `gap` incompatible con RN 0.70 porque se subio a RN 0.71 dentro del mismo downgrade.
- En esta iteracion, iOS no intenta registrar push remoto salvo que definas `EXPO_PUBLIC_IOS_PUSH_ENABLED=1`.
- Sin APNs no hay equivalencia con Android cuando la app esta cerrada; el objetivo actual sigue siendo foreground realtime estable.
- Push remoto iOS no funciona en simulator; prueba en iPhone fisico.
- En iOS Simulator, si la app queda sin coordenadas reales, activa una ubicación simulada desde `Features > Location` (por ejemplo `City Run` o `Custom Location`) para probar mapas, pickup y cálculo de rutas.
- El chofer debe aceptar permiso `Always` para que el tracking en segundo plano funcione bien.
- El bundle identifier actual esperado por la app es `com.xpress.traslados`.