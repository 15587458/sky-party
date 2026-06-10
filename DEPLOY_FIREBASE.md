# 🚀 Guide: Deploying SKY PARTY to Firebase (Hosting + Functions)

This project has been fully optimized to run isomorphically. It works perfectly in development and is **fully prepared** to run both the frontend SPA and the Express backend (emails, payment endpoints, etc.) on Firebase.

---

## 🧐 What Went Wrong Before? (Why you saw "Setup Complete")
When you run `firebase init` on your computer, Firebase CLI by default suggests a directory called `public` and offers to create a placeholder page. If you accept:
1. It creates a dummy `public/index.html` showing the *"Firebase Hosting Setup Complete"* boilerplate.
2. It changes your `firebase.json` to point to `"public"`.
3. When you run `firebase deploy`, it uploads that dummy placeholder page instead of our built React app from `dist/`!

---

## 🛠️ Complete Deployment Steps (Zero Configuration!)
Everything is already configured in the code. Just follow these steps to deploy:

### Step 1: Install Firebase CLI globally (if you haven't yet)
Open your terminal and run:
```bash
npm install -g firebase-tools
```

### Step 2: Login to your Firebase account
```bash
firebase login
```

### Step 3: Link your local project to your Firebase project
Run this command in the project directory:
```bash
firebase use --add
```
*(Select your active Firebase project from the list and give it an alias like `default`)*

### Step 4: Compile and Deploy!
Just run this single unified command. It compiles the React frontend (`dist/`), packages the Express backend as a Firebase Gen 2 Cloud Function, and deploys both simultaneously:
```bash
npm run build && firebase deploy
```

---

## 💡 Where to find Event IDs?
We added multiple quick-access buttons to make this effortless:
1. **Admin Dashboard (Головна сторінка подій)**: Every event card now displays an elegant, high-contrast, clickable **`ID: [КОД]`** pill. Clicking it automatically copies the ID to your clipboard!
2. **Edit Dialog (Редагування події)**: When editing any existing event, the official unique ID is printed at the top-left of the dialog box right next to the title, fully copyable with a single tap!
