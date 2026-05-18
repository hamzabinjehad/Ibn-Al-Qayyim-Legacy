export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => void registration.unregister()))
      .catch((error: unknown) => {
        console.warn("Unable to unregister service workers in development", error);
      });

    if ("caches" in window) {
      window.caches
        .keys()
        .then((keys) => keys.forEach((key) => void window.caches.delete(key)))
        .catch((error: unknown) => {
          console.warn("Unable to clear service worker caches in development", error);
        });
    }

    return;
  }

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch((error: unknown) => {
      console.warn("Unable to register service worker", error);
    });
  });
}
