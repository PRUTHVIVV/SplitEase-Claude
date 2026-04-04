# 💰 SplitEase – Expense Manager

A fully-featured group expense management PWA (Progressive Web App).  
**Works on Android & iOS without any app store.**

---

## 🚀 Features

- **Groups** – Create expense groups (trips, teams, households)
- **Multi-currency** – INR, USD, EUR, GBP, AED, SGD, JPY, and more
- **Categories** – Food, Travel, Stay, Shopping, Entertainment, Transport, Bills, Medical
- **Split options** – Equal, Custom amounts, or Percentage-based
- **Paid / Unpaid** tracking per expense
- **Balance calculator** – Automatically calculates who owes whom
- **Charts** – Category breakdown, Paid vs Unpaid, Monthly trend, Per-member spending
- **Google Drive sync** – All data saved to your private Drive file
- **Offline support** – Works without internet
- **Export to CSV** – Download all expenses as spreadsheet

---

## 📲 Installing on Your Phone (No App Store Needed)

### Android (Chrome)
1. Open `index.html` in Chrome
2. Tap the **menu (⋮)** → "Add to Home Screen"
3. App appears on your home screen like a native app

### iPhone / iPad (Safari)
1. Open `index.html` in Safari
2. Tap the **Share button (↑)** → "Add to Home Screen"
3. App appears on your home screen like a native app

---

## ☁️ Google Drive Setup (Optional but Recommended)

To sync data across devices:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Go to **APIs & Services** → Enable **Google Drive API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: Add the URL where you host this app
5. Copy the **Client ID**
6. In SplitEase, tap **Drive** → paste the Client ID → tap Connect

Your data saves to a file called `splitease_data.json` in your Drive.

### Running Locally
If you're running from a local file (`file://`), use a simple server:
```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```
Then open `http://localhost:8080`

---

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Main app (everything is here) |
| `manifest.json` | PWA metadata for home screen install |
| `sw.js` | Service worker for offline support |
| `README.md` | This file |

---

## 🔒 Privacy

- All data is stored in **your own Google Drive** or **locally on your device**
- No servers, no accounts, no subscriptions
- Data file: `splitease_data.json` in your Google Drive root

---

## 🌐 Hosting (to share with group members)

You can host for free on:
- **GitHub Pages** – Upload files, enable Pages in repo settings
- **Netlify** – Drag & drop the folder at netlify.com
- **Vercel** – `npx vercel` in the folder
- **Google Drive** – Share the HTML file directly

---

Made with ❤️ — No app store needed.
