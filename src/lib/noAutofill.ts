// Nei campi di ricerca il browser proponeva i contatti della rubrica del
// Mac/telefono (Safari e Chrome lo fanno quando il campo "sembra" un nome o un
// numero). Questi attributi spengono sia l'autofill del browser sia quello dei
// gestori di password.
export const NO_AUTOFILL = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': true, // 1Password
  'data-lpignore': 'true', // LastPass
  'data-form-type': 'other', // Dashlane
} as const;
