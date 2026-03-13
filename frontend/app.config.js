// Expo config dinámico para permitir usar google-services.json desde EAS (File env var)
// - En EAS: crear env var tipo "file" llamada GOOGLE_SERVICES_JSON
// - Esta env var expone la ruta del archivo en process.env.GOOGLE_SERVICES_JSON

const appJson = require('./app.json');

module.exports = () => {
  const expo = appJson.expo || {};
  const android = expo.android || {};

  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || android.googleServicesFile;

  return {
    expo: {
      ...expo,
      android: {
        ...android,
        ...(googleServicesFile ? { googleServicesFile } : null),
      },
    },
  };
};
