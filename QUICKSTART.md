# Quick Start Guide

## Get Running in 3 Minutes

### Step 1: Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local
```

### Step 2: Get Groq API Key

1. Go to https://console.groq.com/keys
2. Sign up for free (if needed)
3. Create a new API key
4. Copy the key

### Step 3: Configure

Edit `.env.local`:
```bash
GROQ_API_KEY=your_actual_key_here
```

### Step 4: Run

```bash
npm run dev
```

Open **http://localhost:3000**

## What You Can Do

### 🤖 AI Copilot (`/copilot`)
- Chat with AI to describe your automation needs
- AI generates a complete workflow for you
- Refine and export to builder

### 🎨 Workflow Builder (`/builder`)
- Drag-and-drop workflow design
- 7+ node types available
- Configure, save, and execute workflows

### 📊 Monitor (`/monitor/{executionId}`)
- Real-time execution tracking
- View step outputs and variables
- Handle human approvals

## Example Usage

1. Go to **/copilot**
2. Type: **"I want to automate invoice processing"**
3. Answer the AI's questions
4. Review the generated workflow
5. Click "Export to Builder"
6. Save and execute!

## Troubleshooting

**Issue:** Copilot not responding
- **Fix:** Check your `GROQ_API_KEY` is set correctly in `.env.local`
- Restart dev server after changing env vars

**Issue:** Workflow not saving
- **Fix:** Normal for demo mode - uses in-memory storage
- Add Upstash Redis credentials for persistence (optional)

**Issue:** UI hard to read
- **Fix:** Updated! Refresh your browser (Ctrl+Shift+R)

## Need Help?

- Check [README.md](README.md) for full documentation
- View [docs/API.md](docs/API.md) for API reference
- See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel deployment

---

**You're ready! Start building intelligent workflows.** 🚀

