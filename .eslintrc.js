module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/essential',
    'eslint:recommended'
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'vue/no-parsing-error': [2, { 'x-invalid-end-tag': false }],
    'vue/no-template-key': 'off',
    'vue/valid-v-for': 'off',
    'no-unused-vars': [2, {
      'vars': 'all',
      'args': 'none'
    }],
    'no-undef': 'off'
  },
  parserOptions: {
    parser: 'babel-eslint'
  }
}
