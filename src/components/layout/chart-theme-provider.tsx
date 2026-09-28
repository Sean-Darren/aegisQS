"use client";
import { useEffect } from "react";
import { registerAegisTheme } from "@/components/charts/theme";
export function ChartThemeProvider() {
  useEffect(() => {
    registerAegisTheme();
  }, []);
  return null;
}
