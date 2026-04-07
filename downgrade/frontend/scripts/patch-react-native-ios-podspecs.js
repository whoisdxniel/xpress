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

const brokenBoostUrl =
  "https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2";
const officialBoostUrl =
  "https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2";

if (!fs.existsSync(boostPodspecPath)) {
  console.log("[postinstall] boost.podspec no existe; se omite el parche iOS.");
  process.exit(0);
}

const currentPodspec = fs.readFileSync(boostPodspecPath, "utf8");

if (currentPodspec.includes(officialBoostUrl)) {
  console.log("[postinstall] boost.podspec ya usa el mirror oficial de Boost.");
  process.exit(0);
}

if (!currentPodspec.includes(brokenBoostUrl)) {
  console.log("[postinstall] boost.podspec no coincide con el formato esperado; no se modifica.");
  process.exit(0);
}

const patchedPodspec = currentPodspec.replace(brokenBoostUrl, officialBoostUrl);

fs.writeFileSync(boostPodspecPath, patchedPodspec, "utf8");
console.log("[postinstall] boost.podspec actualizado al mirror oficial de Boost.");