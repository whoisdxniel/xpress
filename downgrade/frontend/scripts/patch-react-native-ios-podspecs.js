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

if (!fs.existsSync(expoDynamicTypePath) || !fs.existsSync(expoDynamicEnumTypePath) || !fs.existsSync(expoEnumerablePath)) {
  console.log("[postinstall] expo-modules-core no existe; se omite ese parche iOS.");
} else {
  const currentDynamicType = fs.readFileSync(expoDynamicTypePath, "utf8");
  const currentDynamicEnumType = fs.readFileSync(expoDynamicEnumTypePath, "utf8");
  const currentEnumerable = fs.readFileSync(expoEnumerablePath, "utf8");

  const enumerableNeedsPatch =
    currentEnumerable.includes(expoEnumerableProtocolOld) ||
    currentEnumerable.includes(expoEnumNoSuchValueOld) ||
    !currentEnumerable.includes("public protocol AnyEnumerable: AnyArgument {");
  const dynamicTypeNeedsPatch = currentDynamicType.includes(expoDynamicTypeOld);
  const dynamicEnumNeedsPatch =
    currentDynamicEnumType.includes("let innerType: any Enumerable.Type") ||
    currentDynamicEnumType.includes("let innerType: Enumerable.Type") ||
    currentDynamicEnumType.includes(expoDynamicEnumCastOld);

  if (!enumerableNeedsPatch && !dynamicTypeNeedsPatch && !dynamicEnumNeedsPatch) {
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

    fs.writeFileSync(expoEnumerablePath, patchedEnumerable, "utf8");
    fs.writeFileSync(expoDynamicTypePath, patchedDynamicType, "utf8");
    fs.writeFileSync(expoDynamicEnumTypePath, patchedDynamicEnumType, "utf8");
    console.log("[postinstall] expo-modules-core ajustado para Swift 5.5/Xcode 13.");
  }
}