"use client";
import { createContext, useContext } from "react";
import type { Experience } from "@/lib/auth/experience";

const ExperienceContext = createContext<Experience | null>(null);
export function ViewerProvider({
  experience,
  children,
}: {
  experience: Experience | null;
  children: React.ReactNode;
}) {
  return (
    <ExperienceContext.Provider value={experience}>
      {children}
    </ExperienceContext.Provider>
  );
}
export function useViewerExperience() {
  return useContext(ExperienceContext);
}
