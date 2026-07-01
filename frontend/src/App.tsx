import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { OnboardingGate, RedirectIfOnboarded } from "./components/OnboardingGate";
import AIDiscovery from "./pages/AIDiscovery";
import Home from "./pages/Home";
import NowPlaying from "./pages/NowPlaying";
import Onboarding from "./pages/Onboarding";
import RecommendationDetails from "./pages/RecommendationDetails";
import RecommendationFeed from "./pages/RecommendationFeed";
import Search from "./pages/Search";
import Welcome from "./pages/Welcome";

export default function App() {
  return (
    <Routes>
      <Route
        path="/welcome"
        element={
          <RedirectIfOnboarded>
            <Welcome />
          </RedirectIfOnboarded>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RedirectIfOnboarded>
            <Onboarding />
          </RedirectIfOnboarded>
        }
      />
      <Route
        path="/"
        element={
          <OnboardingGate>
            <Layout />
          </OnboardingGate>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="discovery" element={<AIDiscovery />} />
        <Route path="feed" element={<RecommendationFeed />} />
        <Route path="recommendations/:id" element={<RecommendationDetails />} />
        <Route path="now-playing" element={<NowPlaying />} />
      </Route>
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
