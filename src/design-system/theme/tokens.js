export const tokens = {
  colors: {
    bg: {
      light: "#F8FAFC",
      dark: "#0B0E11",
    },
    surface: {
      light: "#FFFFFF",
      dark: "#12161A",
    },
    card: {
      light: "#FFFFFF",
      dark: "#1A1F26",
    },
    text: {
      primary: {
        light: "#0B0E11",
        dark: "#FBFAFC",
      },
      secondary: {
        light: "#475569",
        dark: "#A1A7B3",
      }
    },
    primary: "#5E60CE",
    secondary: "#7B7FEA",
    accent: "#A5B4FC",
    focus: "#00E5C3",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    border: {
      light: "#E2E8F0",
      dark: "#232A33",
    },
  },

  radius: {
    sm: "8px",
    md: "12px",
    lg: "20px",
  },

  spacing: (factor) => `${factor * 4}px`,
};
