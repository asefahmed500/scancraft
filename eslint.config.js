// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Reanimated shared values are intentionally mutable refs; the React
    // Compiler immutability rule does not model them.
    files: ["src/app/review.tsx", "src/app/onboarding.tsx", "src/components/logo-reveal.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);
