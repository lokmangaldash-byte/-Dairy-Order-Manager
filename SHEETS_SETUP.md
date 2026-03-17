# Dairy Order Manager — Google Sheets Setup Guide

## Overview
This app uses Google Sheets as the database. Follow the steps below to connect your spreadsheet.

---

## Step 1: Create Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it: **Dairy Order Manager**
3. Create 4 sheets (tabs) with these exact names and headers:

### Sheet 1: `Customers`
| customer_id | name | phone | address |

### Sheet 2: `Products`
| product_id | product_name | unit | price |

### Sheet 3: `Orders`
| order_id | customer_id | delivery_date | status | total_amount | notes |

### Sheet 4: `Order_Items`
| order_id | product_id | quantity | price | total |

> **Important:** Add the header row exactly as shown above in Row 1 of each sheet.

---

## Step 2: Get Your Sheet ID

Your Sheet ID is in the URL when you open the spreadsheet:

```
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
```

Copy the long string between `/d/` and `/edit`.

---

## Step 3: Set Up Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Google Sheets API**:
   - Go to **APIs & Services > Library**
   - Search "Google Sheets API" → Enable it

---

## Step 4: Create API Key

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials → API Key**
3. Copy the key — this is your `API_KEY`
4. (Optional but recommended) Restrict it to Sheets API only

---

## Step 5: Create OAuth 2.0 Client ID

1. Still in **Credentials**, click **Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Add Authorized JavaScript origins:
   - `http://localhost:3000` (for local dev)
   - Your production domain (e.g., `https://yourdomain.com`)
4. Copy the **Client ID** — this is your `CLIENT_ID`

---

## Step 6: Update the App Config

At the top of the app file (`dairy-app.jsx`), replace:

```js
const SHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const API_KEY  = "YOUR_GOOGLE_API_KEY";
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
```

With your actual values.

---

## Step 7: Add Google Identity Script

In your HTML file (or `index.html`), add before `</body>`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## Step 8: Connect in the App

1. Open the app — you'll see **"Demo Mode"** in the sidebar
2. Click **"Connect Google Sheets"**
3. Sign in with Google when prompted
4. The app will load your sheet data automatically

---

## Data Flow

- **Read**: App fetches all rows from each sheet on connect
- **Write**: New customers, products, and orders are appended to the sheet
- **Update**: Status changes and edits update the specific row

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Google API not loaded" | Add the GSI script tag to your HTML |
| "Sheets API error: 403" | Check your API key restrictions & OAuth origins |
| "Sheets API error: 404" | Verify your Sheet ID is correct |
| Data not appearing | Make sure header rows match exactly (case-sensitive) |
| Auth popup blocked | Allow popups for your domain in browser settings |

---

## Security Notes

- Never commit your API Key or Client ID to public repos
- Use environment variables in production: `process.env.REACT_APP_SHEET_ID`
- Restrict your API key to only the Sheets API
- Share the Google Sheet only with trusted staff accounts
