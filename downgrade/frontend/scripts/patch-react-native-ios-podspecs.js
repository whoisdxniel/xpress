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

const brokenBoostUrl =
  "https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2";
const officialBoostUrl =
  "https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2";

const unpinnedTurfDependency = "        s.dependency 'Turf'";
const pinnedTurfDependency = "        s.dependency 'Turf', '= 2.6.1'";

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
  process.exit(0);
}

const currentRnMapboxPodspec = fs.readFileSync(rnMapboxPodspecPath, "utf8");

if (currentRnMapboxPodspec.includes(pinnedTurfDependency)) {
  console.log("[postinstall] rnmapbox-maps.podspec ya fija Turf 2.6.1 para Xcode 13.");
  process.exit(0);
}

if (!currentRnMapboxPodspec.includes(unpinnedTurfDependency)) {
  console.log("[postinstall] rnmapbox-maps.podspec no coincide con el formato esperado; no se modifica.");
  process.exit(0);
}

const patchedRnMapboxPodspec = currentRnMapboxPodspec.replace(
  unpinnedTurfDependency,
  pinnedTurfDependency
);

fs.writeFileSync(rnMapboxPodspecPath, patchedRnMapboxPodspec, "utf8");
console.log("[postinstall] rnmapbox-maps.podspec fijado a Turf 2.6.1 para Xcode 13.");