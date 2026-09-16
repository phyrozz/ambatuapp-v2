# Translating AmbatuApp

The app's interface text lives in two plain JSON files:

- `src/messages/en.json` is the English source.
- `src/messages/id.json` is the Bahasa Indonesia translation.

## What to edit

Translate only the text on the right side of each entry in `id.json`:

```json
"profile.signIn": "Masuk"
```

Do not change the key on the left (`profile.signIn`). Keep punctuation and the comma after an entry where one already exists.

Placeholders wrapped in braces must stay in the translation. They are replaced by the app at runtime:

```json
"games.best": "Terbaik: {score}"
```

Brand, character, and game names such as AmbatuApp, Dreamy, AmbatuTap, and AmbatuWatch normally remain unchanged. The Indonesian language option in the top bar updates immediately, so use it to review translations in context.

## Content outside the interface file

Character biographies and lore stories come from the content API. They are not stored in these interface files. Lore translations use the translation fields in the lore editor/API; character biography translations will need corresponding API fields before they can switch with the interface language.

## Before submitting changes

1. Make sure `id.json` is still valid JSON (no missing commas or quotation marks).
2. Keep every `{placeholder}` from the English entry.
3. Check short text on mobile, especially navigation, buttons, and game controls.
4. Ask a developer to run `npm run typecheck`, `npm run lint`, and `npm run build` from the `revamp` folder.
