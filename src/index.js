import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
```

Click **"Commit changes"**

---

### File 4 — Rename your app file

Your `dairy-app.jsx` needs to be named `src/App.js`. Since GitHub doesn't allow renaming directly:

1. Click **"Add file" → "Create new file"**
2. Name it: `src/App.js`
3. Copy and paste all the contents of your `dairy-app.jsx` into it
4. Commit changes
5. Then delete `dairy-app.jsx` — open it → click the 🗑️ trash icon → commit

---

### Your repo structure should look like this:
```
your-repo/
├── package.json
├── public/
│   └── index.html
└── src/
    ├── index.js
    └── App.js
