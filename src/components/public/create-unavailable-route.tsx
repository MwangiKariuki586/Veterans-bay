import { UnavailablePage } from "@/components/public/unavailable-page";

/** Thin chrome stub for destinations not yet implemented in an ordered phase. */
export function createUnavailableRoute(config: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return function UnavailableRoute() {
    return (
      <UnavailablePage
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
      />
    );
  };
}
