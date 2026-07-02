export const tokens = {
  colors: {
    bg: {
      light: "#FFFFFF",
      dark: "#0F172A",
    },
    text: {
      light: "#0F172A",
      dark: "#FFFFFF",
    },
    primary: "#2563EB", // MyFlowDay primary (blue)
    secondary: "#38BDF8", // MyFlowDay secondary (sky)
    danger: "#EF4444",
    success: "#22C55E",
    border: {
      light: "#E5E7EB",
      dark: "#1F2937",
    },
  },

  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
  },

  spacing: (factor) => `${factor * 4}px`,
};
