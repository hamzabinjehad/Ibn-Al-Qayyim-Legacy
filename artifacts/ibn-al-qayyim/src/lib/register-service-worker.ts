export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch((error: unknown) => {
      console.warn("Unable to register service worker", error);
    });
  });
}
