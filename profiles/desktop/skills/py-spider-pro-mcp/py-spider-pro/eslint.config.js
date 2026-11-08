import pluginJs from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    languageOptions: {
      globals: {
        // Node.js globals
        __dirname: true,
        __filename: true,
        exports: true,
        module: true,
        require: true,
        process: true,
        console: true,
        setTimeout: true,
        setInterval: true,
        clearTimeout: true,
        clearInterval: true,
        Buffer: true,
        URL: true,
        URLSearchParams: true,
        AbortController: true,
        // ES2021 globals
        BigInt: true,
        BigInt64Array: true,
        BigUint64Array: true,
        globalThis: true
      },
      ecmaVersion: "latest",
      sourceType: "module"
    }
  },
  pluginJs.configs.recommended,
  prettierConfig,
  {
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "no-console": "warn",
      "no-debugger": "error",
      "semi": ["error", "always"],
      "quotes": ["error", "single", { "avoidEscape": true }],
      "indent": ["error", 2, { "SwitchCase": 1 }],
      "linebreak-style": ["error", "unix"],
      "comma-dangle": ["error", "never"],
      "space-before-function-paren": ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "always"],
      "arrow-spacing": ["error", { "before": true, "after": true }],
      "keyword-spacing": ["error", { "before": true, "after": true }],
      "space-infix-ops": ["error", { "int32Hint": false }],
      "no-trailing-spaces": "error",
      "eol-last": "error",
      "max-len": ["warn", { "code": 120, "ignoreUrls": true }],
      "no-empty": ["error", { "allowEmptyCatch": true }]
    },
    ignores: ["node_modules/", "dist/", "__pycache__/"]
  }
];
