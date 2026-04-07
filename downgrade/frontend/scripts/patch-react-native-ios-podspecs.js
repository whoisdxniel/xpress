const fs = require("fs");
const path = require("path");

const boostPodspecPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native",
  "third-party-podspecs",
  "boost.podspec"
);

const rnMapboxPodspecPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "rnmapbox-maps.podspec"
);

const rnMapboxMapViewPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "ios",
  "RNMBX",
  "RNMBXMapView.swift"
);

const rnMapboxNativeUserLocationPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "ios",
  "RNMBX",
  "RNMBXNativeUserLocation.swift"
);

const rnMapboxLayerPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "ios",
  "RNMBX",
  "RNMBXLayer.swift"
);

const rnMapboxChangeLineOffsetsAnimatorPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "ios",
  "RNMBX",
  "ShapeAnimators",
  "RNMBXChangeLineOffsetsShapeAnimatorModule.swift"
);

const rnMapboxModulePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@rnmapbox",
  "maps",
  "ios",
  "RNMBX",
  "RNMBXModule.swift"
);

const expoDynamicTypePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "ios",
  "Swift",
  "DynamicTypes",
  "DynamicType.swift"
);

const expoDynamicEnumTypePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "ios",
  "Swift",
  "DynamicTypes",
  "DynamicEnumType.swift"
);

const expoEnumerablePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "ios",
  "Swift",
  "Arguments",
  "Enumerable.swift"
);

const expoPropertyComponentPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "ios",
  "Swift",
  "Objects",
  "PropertyComponent.swift"
);

const brokenBoostUrl =
  "https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2";
const officialBoostUrl =
  "https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2";

const unpinnedTurfDependency = "        s.dependency 'Turf'";
const pinnedTurfDependency = "        s.dependency 'Turf', '= 2.6.1'";

const expoEnumerableProtocolOld = "public protocol Enumerable: AnyArgument, CaseIterable {";
const expoEnumerableProtocolNew = [
  "public protocol AnyEnumerable: AnyArgument {",
  "  static func createAny<RawValueType>(fromRawValue rawValue: RawValueType) throws -> Any",
  "  static var allRawValues: [Any] { get }",
  "}",
  "",
  "public protocol Enumerable: AnyEnumerable, CaseIterable {",
].join("\n");
const expoCreateExtensionOld = [
  "  static var allRawValues: [Any] {",
  "    return allCases.map { $0.rawValue }",
  "  }",
  "}",
].join("\n");
const expoCreateExtensionNew = [
  "  static var allRawValues: [Any] {",
  "    return allCases.map { $0.rawValue }",
  "  }",
  "",
  "  static func createAny<ArgType>(fromRawValue rawValue: ArgType) throws -> Any {",
  "    return try create(fromRawValue: rawValue)",
  "  }",
  "}",
].join("\n");
const expoEnumNoSuchValueOld = "internal class EnumNoSuchValueException: GenericException<(type: Enumerable.Type, value: Any)> {";
const expoEnumNoSuchValueNew = "internal class EnumNoSuchValueException: GenericException<(type: AnyEnumerable.Type, value: Any)> {";
const expoDynamicTypeOld = "  if let EnumType = T.self as? Enumerable.Type {";
const expoDynamicTypeNew = "  if let EnumType = T.self as? AnyEnumerable.Type {";
const expoDynamicEnumTypeOld = [
  "internal struct DynamicEnumType: AnyDynamicType {",
  "  let innerType: Enumerable.Type",
].join("\n");
const expoDynamicEnumTypeNew = [
  "internal struct DynamicEnumType: AnyDynamicType {",
  "  let innerType: AnyEnumerable.Type",
].join("\n");
const expoDynamicEnumCastOld = "    return try innerType.create(fromRawValue: value)";
const expoDynamicEnumCastNew = "    return try innerType.createAny(fromRawValue: value)";
const expoPropertyGetterGuardOld = [
  "      guard let getter = self.getter else {",
  "        return",
  "      }",
].join("\n");
const expoPropertyGetterGuardNil = [
  "      guard let getter = self.getter else {",
  "        return nil",
  "      }",
].join("\n");
const expoPropertyGetterGuardNew = [
  "      guard let getter = self.getter else {",
  "        return Optional<Any>.none as Any",
  "      }",
].join("\n");
const expoPropertySetterGuardOld = [
  "      guard let setter = self.setter else {",
  "        return",
  "      }",
].join("\n");
const expoPropertySetterGuardNil = [
  "      guard let setter = self.setter else {",
  "        return nil",
  "      }",
].join("\n");
const expoPropertySetterGuardNew = [
  "      guard let setter = self.setter else {",
  "        return Optional<Any>.none as Any",
  "      }",
].join("\n");

const rnMapboxLayerHelperOld = [
  "#if RNMBX_11",
  "func getLayerSourceDetails(layer: (any Layer)?) -> LayerSourceDetails? {",
  "    if let circleLayer = layer as? CircleLayer {",
  "        return (circleLayer.source, circleLayer.sourceLayer)",
  "    } else if let fillExtrusionLayer = layer as? FillExtrusionLayer {",
  "        return (fillExtrusionLayer.source, fillExtrusionLayer.sourceLayer)",
  "    } else if let fillLayer = layer as? FillLayer {",
  "        return (fillLayer.source, fillLayer.sourceLayer)",
  "    } else if let heatmapLayer = layer as? HeatmapLayer {",
  "        return (heatmapLayer.source, heatmapLayer.sourceLayer)",
  "    } else if let hillshadeLayer = layer as? HillshadeLayer {",
  "        return (hillshadeLayer.source, hillshadeLayer.sourceLayer)",
  "    } else if let lineLayer = layer as? LineLayer {",
  "        return (lineLayer.source, lineLayer.sourceLayer)",
  "    } else if let rasterLayer = layer as? RasterLayer {",
  "        return (rasterLayer.source, rasterLayer.sourceLayer)",
  "    } else if let symbolLayer = layer as? SymbolLayer {",
  "        return (symbolLayer.source, symbolLayer.sourceLayer)",
  "    } else {",
  "        return nil",
  "    }",
  "}",
  "#endif",
].join("\n");
const rnMapboxLayerHelperNew = [
  "#if RNMBX_11",
  "func getLayerSourceDetails(style: Style, layerId: String) -> LayerSourceDetails? {",
  "    if let circleLayer = try? style.layer(withId: layerId, type: CircleLayer.self) {",
  "        return (circleLayer.source, circleLayer.sourceLayer)",
  "    } else if let fillExtrusionLayer = try? style.layer(withId: layerId, type: FillExtrusionLayer.self) {",
  "        return (fillExtrusionLayer.source, fillExtrusionLayer.sourceLayer)",
  "    } else if let fillLayer = try? style.layer(withId: layerId, type: FillLayer.self) {",
  "        return (fillLayer.source, fillLayer.sourceLayer)",
  "    } else if let heatmapLayer = try? style.layer(withId: layerId, type: HeatmapLayer.self) {",
  "        return (heatmapLayer.source, heatmapLayer.sourceLayer)",
  "    } else if let hillshadeLayer = try? style.layer(withId: layerId, type: HillshadeLayer.self) {",
  "        return (hillshadeLayer.source, hillshadeLayer.sourceLayer)",
  "    } else if let lineLayer = try? style.layer(withId: layerId, type: LineLayer.self) {",
  "        return (lineLayer.source, lineLayer.sourceLayer)",
  "    } else if let rasterLayer = try? style.layer(withId: layerId, type: RasterLayer.self) {",
  "        return (rasterLayer.source, rasterLayer.sourceLayer)",
  "    } else if let rasterParticleLayer = try? style.layer(withId: layerId, type: RasterParticleLayer.self) {",
  "        return (rasterParticleLayer.source, rasterParticleLayer.sourceLayer)",
  "    } else if let symbolLayer = try? style.layer(withId: layerId, type: SymbolLayer.self) {",
  "        return (symbolLayer.source, symbolLayer.sourceLayer)",
  "    } else if let modelLayer = try? style.layer(withId: layerId, type: ModelLayer.self) {",
  "        return (modelLayer.source, modelLayer.sourceLayer)",
  "    } else {",
  "        return nil",
  "    }",
  "}",
  "#endif",
].join("\n");
const rnMapboxSetSourceVisibilityOld = [
  "extension RNMBXMapView {",
  "  func setSourceVisibility(_ visible: Bool, sourceId: String, sourceLayerId: String?) -> Void {",
  "    let style = self.mapboxMap.style",
  "",
  "    style.allLayerIdentifiers.forEach { layerInfo in",
  "      let layer = logged(\"setSourceVisibility.layer\", info: { \"\\(layerInfo.id)\" }) {",
  "        try style.layer(withId: layerInfo.id)",
  "      }",
  "",
  "      #if RNMBX_11",
  "        let sourceDetails = getLayerSourceDetails(layer: layer)",
  "      #else",
  "        let sourceDetails: LayerSourceDetails? = (source: layer?.source, sourceLayer: layer?.sourceLayer)",
  "      #endif",
  "",
  "      if let layer = layer, let sourceDetails = sourceDetails {",
  "        if sourceDetails.source == sourceId {",
  "          var good = true",
  "          if let sourceLayerId = sourceLayerId {",
  "            if sourceLayerId != sourceDetails.sourceLayer {",
  "              good = false",
  "            }",
  "          }",
  "          if good {",
  "            do {",
  "              try style.setLayerProperty(for: layer.id, property: \"visibility\", value: visible ? \"visible\" : \"none\")",
  "            } catch {",
  "              Logger.log(level: .error, message: \"Cannot change visibility of \\(layer.id) with source: \\(sourceId)\")",
  "            }",
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
].join("\n");
const rnMapboxSetSourceVisibilityNew = [
  "extension RNMBXMapView {",
  "  func setSourceVisibility(_ visible: Bool, sourceId: String, sourceLayerId: String?) -> Void {",
  "    let style = self.mapboxMap.style",
  "",
  "    style.allLayerIdentifiers.forEach { layerInfo in",
  "      #if RNMBX_11",
  "        let sourceDetails = getLayerSourceDetails(style: style, layerId: layerInfo.id)",
  "      #else",
  "        let layer = logged(\"setSourceVisibility.layer\", info: { \"\\(layerInfo.id)\" }) {",
  "          try style.layer(withId: layerInfo.id)",
  "        }",
  "        let sourceDetails: LayerSourceDetails? = (source: layer?.source, sourceLayer: layer?.sourceLayer)",
  "      #endif",
  "",
  "      if let sourceDetails = sourceDetails {",
  "        if sourceDetails.source == sourceId {",
  "          var good = true",
  "          if let sourceLayerId = sourceLayerId {",
  "            if sourceLayerId != sourceDetails.sourceLayer {",
  "              good = false",
  "            }",
  "          }",
  "          if good {",
  "            do {",
  "              try style.setLayerProperty(for: layerInfo.id, property: \"visibility\", value: visible ? \"visible\" : \"none\")",
  "            } catch {",
  "              Logger.log(level: .error, message: \"Cannot change visibility of \\(layerInfo.id) with source: \\(sourceId)\")",
  "            }",
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
].join("\n");
const rnMapboxPuckBearingTypeOld = "  var _puckBearing: PuckBearing? = nil";
const rnMapboxPuckBearingTypeNew = [
  "#if RNMBX_11",
  "  typealias RNMBXPuckBearing = PuckBearing",
  "#else",
  "  typealias RNMBXPuckBearing = PuckBearingSource",
  "#endif",
  "",
  "  var _puckBearing: RNMBXPuckBearing? = nil",
].join("\n");
const rnMapboxPuckBearingSetterOld = [
  "    location.options.puckBearingEnabled = puckBearingEnabled",
  "    if let puckBearing = _puckBearing {",
  "      location.options.puckBearing = puckBearing",
  "    }",
].join("\n");
const rnMapboxPuckBearingSetterNew = [
  "    location.options.puckBearingEnabled = puckBearingEnabled",
  "    if let puckBearing = _puckBearing {",
  "      #if RNMBX_11",
  "        location.options.puckBearing = puckBearing",
  "      #else",
  "        location.options.puckBearingSource = puckBearing",
  "      #endif",
  "    }",
].join("\n");
const rnMapboxSetBaseOptionsOld = "  func setBaseOptions<T: Layer>(_ layer: inout T) {";
const rnMapboxSetBaseOptionsNew = "  func setBaseOptions(_ layer: inout Layer) {";
const rnMapboxBuildLineStringOld = [
  "private func buildLineString(_coordinates: NSArray) -> LineString {",
  "  let coordinates = _coordinates.map { coord in",
  "    let coord = coord as! [NSNumber]",
  "    return LocationCoordinate2D(latitude: coord[1].doubleValue, longitude: coord[0].doubleValue)",
  "  }",
  "  ",
  "  return .init(coordinates)",
  "}",
].join("\n");
const rnMapboxBuildLineStringNew = [
  "private func buildLineString(_coordinates: NSArray) -> LineString {",
  "  let coordinates: [LocationCoordinate2D] = _coordinates.compactMap { coord -> LocationCoordinate2D? in",
  "    guard let coordinatePair = coord as? [NSNumber], coordinatePair.count >= 2 else {",
  "      return nil",
  "    }",
  "",
  "    return LocationCoordinate2D(",
  "      latitude: coordinatePair[1].doubleValue,",
  "      longitude: coordinatePair[0].doubleValue",
  "    )",
  "  }",
  "",
  "  return .init(coordinates)",
  "}",
].join("\n");
const rnMapboxMapViewAccessTokenOld = [
  "      let accessToken = RNMBXModule.accessToken",
  "      if accessToken == nil {",
  "        Logger.log(level: .error, message: \"No accessToken set, please call Mapbox.setAccessToken(...)\")",
  "      }",
  "      let resourceOptions = ResourceOptions(accessToken: accessToken ?? \"\")",
].join("\n");
const rnMapboxMapViewAccessTokenNew = [
  "      let accessToken = RNMBXModule.accessToken ?? RNMBXModule.defaultAccessToken()",
  "      if RNMBXModule.accessToken == nil, let token = accessToken {",
  "        RNMBXModule.accessToken = token",
  "      }",
  "      if accessToken == nil {",
  "        Logger.log(level: .error, message: \"No accessToken set, please call Mapbox.setAccessToken(...)\")",
  "      }",
  "      let resourceOptions = ResourceOptions(accessToken: accessToken ?? \"\")",
].join("\n");
const rnMapboxDefaultAccessTokenOld = [
  "class RNMBXModule : NSObject {",
  "  ",
  "  public static var accessToken : String? {",
].join("\n");
const rnMapboxDefaultAccessTokenNew = [
  "class RNMBXModule : NSObject {",
  "  static func defaultAccessToken() -> String? {",
  "    if let token = accessToken?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty {",
  "      return token",
  "    }",
  "",
  "    let keys = [\"MBXAccessToken\", \"MGLMapboxAccessToken\"]",
  "    for key in keys {",
  "      if let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String {",
  "        let token = raw.trimmingCharacters(in: .whitespacesAndNewlines)",
  "        if !token.isEmpty {",
  "          return token",
  "        }",
  "      }",
  "    }",
  "",
  "    return nil",
  "  }",
  "",
  "  override public init() {",
  "    super.init()",
  "    if let token = RNMBXModule.defaultAccessToken() {",
  "      RNMBXModule.accessToken = token",
  "    }",
  "  }",
  "  ",
  "  public static var accessToken : String? {",
].join("\n");
const rnMapboxConstantsAccessTokenOld = '      "MapboxV10":true,';
const rnMapboxConstantsAccessTokenNew = [
  '      "MapboxV10":true,',
  '      "AccessToken": RNMBXModule.defaultAccessToken() ?? "",',
].join("\n");

if (!fs.existsSync(boostPodspecPath)) {
  console.log("[postinstall] boost.podspec no existe; se omite ese parche iOS.");
} else {
  const currentBoostPodspec = fs.readFileSync(boostPodspecPath, "utf8");

  if (currentBoostPodspec.includes(officialBoostUrl)) {
    console.log("[postinstall] boost.podspec ya usa el mirror oficial de Boost.");
  } else if (!currentBoostPodspec.includes(brokenBoostUrl)) {
    console.log("[postinstall] boost.podspec no coincide con el formato esperado; no se modifica.");
  } else {
    const patchedBoostPodspec = currentBoostPodspec.replace(brokenBoostUrl, officialBoostUrl);
    fs.writeFileSync(boostPodspecPath, patchedBoostPodspec, "utf8");
    console.log("[postinstall] boost.podspec actualizado al mirror oficial de Boost.");
  }
}

if (!fs.existsSync(rnMapboxPodspecPath)) {
  console.log("[postinstall] rnmapbox-maps.podspec no existe; se omite ese parche iOS.");
} else {
  const currentRnMapboxPodspec = fs.readFileSync(rnMapboxPodspecPath, "utf8");

  if (currentRnMapboxPodspec.includes(pinnedTurfDependency)) {
    console.log("[postinstall] rnmapbox-maps.podspec ya fija Turf 2.6.1 para Xcode 13.");
  } else if (!currentRnMapboxPodspec.includes(unpinnedTurfDependency)) {
    console.log("[postinstall] rnmapbox-maps.podspec no coincide con el formato esperado; no se modifica.");
  } else {
    const patchedRnMapboxPodspec = currentRnMapboxPodspec.replace(
      unpinnedTurfDependency,
      pinnedTurfDependency
    );

    fs.writeFileSync(rnMapboxPodspecPath, patchedRnMapboxPodspec, "utf8");
    console.log("[postinstall] rnmapbox-maps.podspec fijado a Turf 2.6.1 para Xcode 13.");
  }
}

if (
  !fs.existsSync(rnMapboxMapViewPath) ||
  !fs.existsSync(rnMapboxNativeUserLocationPath) ||
  !fs.existsSync(rnMapboxLayerPath) ||
  !fs.existsSync(rnMapboxChangeLineOffsetsAnimatorPath) ||
  !fs.existsSync(rnMapboxModulePath)
) {
  console.log("[postinstall] RNMapbox iOS sources no existen; se omite ese parche Swift.");
} else {
  const currentRnMapboxMapView = fs.readFileSync(rnMapboxMapViewPath, "utf8");
  const currentRnMapboxNativeUserLocation = fs.readFileSync(rnMapboxNativeUserLocationPath, "utf8");
  const currentRnMapboxLayer = fs.readFileSync(rnMapboxLayerPath, "utf8");
  const currentRnMapboxModule = fs.readFileSync(rnMapboxModulePath, "utf8");
  const currentRnMapboxChangeLineOffsetsAnimator = fs.readFileSync(
    rnMapboxChangeLineOffsetsAnimatorPath,
    "utf8"
  );

  const rnMapboxMapViewNeedsPatch =
    currentRnMapboxMapView.includes(rnMapboxLayerHelperOld) ||
    currentRnMapboxMapView.includes(rnMapboxSetSourceVisibilityOld) ||
    currentRnMapboxMapView.includes(rnMapboxMapViewAccessTokenOld);
  const rnMapboxNativeUserLocationNeedsPatch =
    currentRnMapboxNativeUserLocation.includes(rnMapboxPuckBearingTypeOld) ||
    currentRnMapboxNativeUserLocation.includes(rnMapboxPuckBearingSetterOld) ||
    !currentRnMapboxNativeUserLocation.includes("typealias RNMBXPuckBearing = PuckBearingSource");
  const rnMapboxLayerNeedsPatch = currentRnMapboxLayer.includes(rnMapboxSetBaseOptionsOld);
  const rnMapboxChangeLineOffsetsAnimatorNeedsPatch =
    currentRnMapboxChangeLineOffsetsAnimator.includes(rnMapboxBuildLineStringOld) ||
    !currentRnMapboxChangeLineOffsetsAnimator.includes(
      "let coordinates: [LocationCoordinate2D] = _coordinates.compactMap"
    );
  const rnMapboxModuleNeedsPatch =
    currentRnMapboxModule.includes(rnMapboxDefaultAccessTokenOld) ||
    !currentRnMapboxModule.includes('"AccessToken": RNMBXModule.defaultAccessToken() ?? ""');

  if (
    !rnMapboxMapViewNeedsPatch &&
    !rnMapboxNativeUserLocationNeedsPatch &&
    !rnMapboxLayerNeedsPatch &&
    !rnMapboxChangeLineOffsetsAnimatorNeedsPatch &&
    !rnMapboxModuleNeedsPatch
  ) {
    console.log("[postinstall] RNMapbox iOS ya es compatible con Swift 5.5 y Mapbox 10 para Xcode 13.");
  } else {
    const patchedRnMapboxMapView = currentRnMapboxMapView
      .replace(rnMapboxLayerHelperOld, rnMapboxLayerHelperNew)
      .replace(rnMapboxSetSourceVisibilityOld, rnMapboxSetSourceVisibilityNew)
      .replace(rnMapboxMapViewAccessTokenOld, rnMapboxMapViewAccessTokenNew);
    const patchedRnMapboxNativeUserLocation = currentRnMapboxNativeUserLocation
      .replace(rnMapboxPuckBearingTypeOld, rnMapboxPuckBearingTypeNew)
      .replace(rnMapboxPuckBearingSetterOld, rnMapboxPuckBearingSetterNew);
    const patchedRnMapboxLayer = currentRnMapboxLayer.replace(
      rnMapboxSetBaseOptionsOld,
      rnMapboxSetBaseOptionsNew
    );
    const patchedRnMapboxModule = currentRnMapboxModule
      .replace(rnMapboxDefaultAccessTokenOld, rnMapboxDefaultAccessTokenNew)
      .replace(rnMapboxConstantsAccessTokenOld, rnMapboxConstantsAccessTokenNew);
    const patchedRnMapboxChangeLineOffsetsAnimator = currentRnMapboxChangeLineOffsetsAnimator.replace(
      rnMapboxBuildLineStringOld,
      rnMapboxBuildLineStringNew
    );

    fs.writeFileSync(rnMapboxMapViewPath, patchedRnMapboxMapView, "utf8");
    fs.writeFileSync(rnMapboxNativeUserLocationPath, patchedRnMapboxNativeUserLocation, "utf8");
    fs.writeFileSync(rnMapboxLayerPath, patchedRnMapboxLayer, "utf8");
    fs.writeFileSync(rnMapboxModulePath, patchedRnMapboxModule, "utf8");
    fs.writeFileSync(
      rnMapboxChangeLineOffsetsAnimatorPath,
      patchedRnMapboxChangeLineOffsetsAnimator,
      "utf8"
    );
    console.log("[postinstall] RNMapbox iOS ajustado para Swift 5.5 y Mapbox 10 en Xcode 13.");
  }
}

if (
  !fs.existsSync(expoDynamicTypePath) ||
  !fs.existsSync(expoDynamicEnumTypePath) ||
  !fs.existsSync(expoEnumerablePath) ||
  !fs.existsSync(expoPropertyComponentPath)
) {
  console.log("[postinstall] expo-modules-core no existe; se omite ese parche iOS.");
} else {
  const currentDynamicType = fs.readFileSync(expoDynamicTypePath, "utf8");
  const currentDynamicEnumType = fs.readFileSync(expoDynamicEnumTypePath, "utf8");
  const currentEnumerable = fs.readFileSync(expoEnumerablePath, "utf8");
  const currentPropertyComponent = fs.readFileSync(expoPropertyComponentPath, "utf8");

  const enumerableNeedsPatch =
    currentEnumerable.includes(expoEnumerableProtocolOld) ||
    currentEnumerable.includes(expoEnumNoSuchValueOld) ||
    !currentEnumerable.includes("public protocol AnyEnumerable: AnyArgument {");
  const dynamicTypeNeedsPatch = currentDynamicType.includes(expoDynamicTypeOld);
  const dynamicEnumNeedsPatch =
    currentDynamicEnumType.includes("let innerType: any Enumerable.Type") ||
    currentDynamicEnumType.includes("let innerType: Enumerable.Type") ||
    currentDynamicEnumType.includes(expoDynamicEnumCastOld);
  const propertyComponentNeedsPatch =
    currentPropertyComponent.includes(expoPropertyGetterGuardOld) ||
    currentPropertyComponent.includes(expoPropertyGetterGuardNil) ||
    currentPropertyComponent.includes(expoPropertySetterGuardOld) ||
    currentPropertyComponent.includes(expoPropertySetterGuardNil);

  if (!enumerableNeedsPatch && !dynamicTypeNeedsPatch && !dynamicEnumNeedsPatch && !propertyComponentNeedsPatch) {
    console.log("[postinstall] expo-modules-core ya es compatible con Swift 5.5/Xcode 13.");
  } else {
    const patchedEnumerable = currentEnumerable
      .replace(expoEnumerableProtocolOld, expoEnumerableProtocolNew)
      .replace(expoCreateExtensionOld, expoCreateExtensionNew)
      .replace(expoEnumNoSuchValueOld, expoEnumNoSuchValueNew);
    const patchedDynamicType = dynamicTypeNeedsPatch
      ? currentDynamicType.replace(expoDynamicTypeOld, expoDynamicTypeNew)
      : currentDynamicType;
    let patchedDynamicEnumType = currentDynamicEnumType
      .replace("let innerType: any Enumerable.Type", "let innerType: AnyEnumerable.Type")
      .replace("let innerType: Enumerable.Type", "let innerType: AnyEnumerable.Type")
      .replace(expoDynamicEnumCastOld, expoDynamicEnumCastNew);
    const patchedPropertyComponent = currentPropertyComponent
      .replace(expoPropertyGetterGuardOld, expoPropertyGetterGuardNew)
      .replace(expoPropertyGetterGuardNil, expoPropertyGetterGuardNew)
      .replace(expoPropertySetterGuardOld, expoPropertySetterGuardNew)
      .replace(expoPropertySetterGuardNil, expoPropertySetterGuardNew);
    fs.writeFileSync(expoEnumerablePath, patchedEnumerable, "utf8");
    fs.writeFileSync(expoDynamicTypePath, patchedDynamicType, "utf8");
    fs.writeFileSync(expoDynamicEnumTypePath, patchedDynamicEnumType, "utf8");
    fs.writeFileSync(expoPropertyComponentPath, patchedPropertyComponent, "utf8");
    console.log("[postinstall] expo-modules-core ajustado para Swift 5.5/Xcode 13.");
  }
}