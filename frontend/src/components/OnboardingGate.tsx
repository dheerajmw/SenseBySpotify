import { Navigate } from "react-router-dom";
import { useProfile } from "../contexts/ProfileContext";

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { isOnboarded } = useProfile();
  if (!isOnboarded) {
    return <Navigate to="/welcome" replace />;
  }
  return children;
}

export function RedirectIfOnboarded({ children }: OnboardingGateProps) {
  const { isOnboarded } = useProfile();
  if (isOnboarded) {
    return <Navigate to="/home" replace />;
  }
  return children;
}
