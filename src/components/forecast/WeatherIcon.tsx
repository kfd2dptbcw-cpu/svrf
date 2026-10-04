import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";

/** Map a WMO weather code (as used by Open-Meteo) to an icon and description. */
export function weatherInfo(code: number | null) {
  if (code === null) return { Icon: CloudSun, label: "Weather unavailable" };
  if (code === 0) return { Icon: Sun, label: "Clear" };
  if (code <= 2) return { Icon: CloudSun, label: "Partly cloudy" };
  if (code === 3) return { Icon: Cloud, label: "Overcast" };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: "Fog" };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: CloudRain, label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { Icon: CloudSnow, label: "Snow" };
  if (code >= 95) return { Icon: CloudLightning, label: "Thunderstorms" };
  return { Icon: Cloud, label: "Cloudy" };
}

export function WeatherIcon({ code, className = "h-5 w-5" }: { code: number | null; className?: string }) {
  const { Icon, label } = weatherInfo(code);
  return <Icon className={className} aria-label={label} role="img" />;
}
