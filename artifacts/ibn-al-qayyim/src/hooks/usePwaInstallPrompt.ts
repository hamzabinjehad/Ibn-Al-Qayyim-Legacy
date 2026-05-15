import { useCallback, useEffect, useState } from "react";

type InstallOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptChoice {
  outcome: InstallOutcome;
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

export function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window === "undefined" ? false : isStandaloneDisplay(),
  );

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isStandaloneDisplay()) return;
      setIsInstalled(false);
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setPromptEvent(null);
      setIsInstalled(true);
    };

    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplay());
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome | null> => {
    if (!promptEvent) return null;

    let choice: BeforeInstallPromptChoice | null = null;

    try {
      await promptEvent.prompt();
      choice = await promptEvent.userChoice.catch(() => null);
    } catch {
      choice = null;
    } finally {
      setPromptEvent(null);
    }

    if (choice?.outcome === "accepted" || isStandaloneDisplay()) {
      setIsInstalled(true);
    }

    return choice?.outcome ?? null;
  }, [promptEvent]);

  return {
    canInstall: Boolean(promptEvent) && !isInstalled,
    install,
    isInstalled,
  };
}
