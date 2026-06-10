# GitVisualizer 🌳

A modern, clean, and interactive Directed Acyclic Graph (DAG) visualizer for GitHub repositories. Explore branch merges, commit flows, and technical architectures with ease.

## ✨ Features

- **Interactive Visualization**: Render complex Git histories and branch merges into a beautiful, easy-to-navigate DAG using React Flow.
- **AI-Powered Commit Summaries**: Understand what changed in a commit at a glance. Integrated with the Gemini API to provide intelligent code review summaries, impact analysis, and focus areas.
- **Insights & Stats**: View contributor leaderboards, file statistics, and commit metadata.
- **Bilingual Support**: Seamlessly switch between English (EN) and Indonesian (ID) interfaces across all components.
- **GitHub API Integration**: Fetch any public repository directly. Support for Personal Access Tokens (PAT) to bypass GitHub API rate limits.
- **Performance Optimized**: Groups linear commit paths into folded capsules, with in-memory caching (5-min TTL) and ELK layout engine to keep the graph uncluttered and performant, even for large repositories.
- **Accessibility**: Keyboard-navigable contributor panels, click-outside and Escape key handlers on modals, and ARIA roles for interactive elements.
- **Security Hardened**: Rate limiting, SSRF protection, Helmet CSP headers, and input validation on all API endpoints.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Gemini API Key (for the AI Summary feature)
- A GitHub Personal Access Token (optional, to increase API rate limit)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gitvisualizer.git
   cd gitvisualizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env` file in the root directory based on the `.env.example` file (you will need to create this if it's not present):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The application will run on `http://localhost:3000`.

### Building for Production

To create a production build and run it locally:

```bash
npm run build
npm start
```

> **Note:** The `dev` and `start` scripts use `cross-env` to set `NODE_ENV` for cross-platform compatibility.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS v4, `@xyflow/react` v12 (graph rendering), motion v12 (animations), Lucide React (icons)
- **Backend**: Node.js, Express.js (serving API and static frontend assets)
- **AI & Integrations**: Google Gemini API (`@google/genai`), GitHub REST API
- **Security**: Helmet (CSP), express-rate-limit, strict SSRF validation
- **Layout**: ELK (Eclipse Layout Kernel) for automatic graph arrangement

## 💡 How it Works

1. Enter any public GitHub repository URL (e.g., `https://github.com/facebook/react`).
2. The Node.js backend proxy fetches the commit history and branch data using the GitHub REST API.
3. Commits are parsed to determine branch topology and conventional commit types (feature, bug fix, merge, etc.).
4. The frontend renders the parsed data as an interactive multi-branch graph.
5. Click on any commit node to view detailed file diffs, or click **Generate AI Review** to get an automated code review.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📝 License

This project is licensed under the MIT License.
