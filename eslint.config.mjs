import js from "@eslint/js";
import globals from "globals";

export default [
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    languageOptions: { 
      // Keep browser if you're doing full-stack, 
      // but you definitely need node for process.env
      globals: {
        ...globals.browser,
        ...globals.node 
      } 
    },
    // Using the recommended rules from the js plugin
    rules: js.configs.recommended.rules,
  },
];