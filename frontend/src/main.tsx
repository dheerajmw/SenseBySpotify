import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AutoplayController from "./components/AutoplayController";
import DiscoveryChangeModal from "./components/DiscoveryChangeModal";
import IntentChangeModal from "./components/IntentChangeModal";
import IntentToast from "./components/IntentToast";
import LearningNotification from "./components/LearningNotification";
import SessionDebugger from "./components/SessionDebugger";
import SplashScreen from "./components/SplashScreen";
import { ProfileProvider } from "./contexts/ProfileContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { RecommendationsProvider } from "./contexts/RecommendationsContext";
import { SessionProvider } from "./contexts/SessionContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SplashScreen />
      <ProfileProvider>
        <RecommendationsProvider>
          <SessionProvider>
            <PlayerProvider>
              <App />
              <AutoplayController />
              <IntentChangeModal />
              <DiscoveryChangeModal />
              <LearningNotification />
              <IntentToast />
              <SessionDebugger />
            </PlayerProvider>
          </SessionProvider>
        </RecommendationsProvider>
      </ProfileProvider>
    </BrowserRouter>
  </StrictMode>,
);
