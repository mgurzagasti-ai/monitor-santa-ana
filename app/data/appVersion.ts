export type PublicAppVersion = {
  latestVersionCode: number;
  latestVersionName: string;
  title: string;
  message: string;
  playStoreUrl: string;
  required: boolean;
  updatedAt: string;
};

const DEFAULT_VERSION_CODE = 4;
const DEFAULT_VERSION_NAME = "1.1.2";
const DEFAULT_PACKAGE_ID = "ar.com.santaana.bus";

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getPublicAppVersion(): PublicAppVersion {
  const latestVersionCode = readNumber(process.env.PUBLIC_APP_LATEST_VERSION_CODE, DEFAULT_VERSION_CODE);
  const latestVersionName = process.env.PUBLIC_APP_LATEST_VERSION_NAME?.trim() || DEFAULT_VERSION_NAME;
  const packageId = process.env.PUBLIC_APP_PACKAGE_ID?.trim() || DEFAULT_PACKAGE_ID;

  return {
    latestVersionCode,
    latestVersionName,
    title: process.env.PUBLIC_APP_VERSION_TITLE?.trim() || "Nueva version disponible",
    message:
      process.env.PUBLIC_APP_VERSION_MESSAGE?.trim() ||
      `Ya podes actualizar Colectivos Jujuy a la version ${latestVersionName} desde Google Play.`,
    playStoreUrl:
      process.env.PUBLIC_APP_PLAY_STORE_URL?.trim() ||
      `https://play.google.com/store/apps/details?id=${packageId}`,
    required: process.env.PUBLIC_APP_UPDATE_REQUIRED === "true",
    updatedAt: new Date().toISOString()
  };
}