// Dynamic Expo config to allow env-based overrides (keeps app.json as source of truth).
// We keep this file minimal; Mapbox is configured at runtime via @rnmapbox/maps.

const appJson = require("./app.json");

module.exports = ({ config }) => {
  return (appJson && appJson.expo) || config || {};
};
