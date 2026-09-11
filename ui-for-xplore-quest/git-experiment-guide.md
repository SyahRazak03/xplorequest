# Git UI Experiment Guide

This guide helps you manage your Git branches while experimenting with new UI styles and designs.

---

## 1. Start the Experiment
Run this command to create and switch to a new branch called `UI-style-experiment`:
```bash
git checkout -b UI-style-experiment
```

---

## 2. Option A: Go Back to Original UI (Keep Experiments Saved)
If you want to return to the original UI on `main` but keep your experiments saved to look at or work on later:

1. Stage and commit your experimental changes:
   ```bash
   git add .
   git commit -m "Save my UI experiments"
   ```
2. Switch back to your clean `main` branch:
   ```bash
   git checkout main
   ```
*(To return to your experiments later, just run `git checkout UI-style-experiment`)*

---

## 3. Option B: Discard Experiments Completely (Revert to Clean UI)
If you do not like any of your changes and want to completely erase the experiment:

1. Switch back to the `main` branch:
   ```bash
   git checkout main
   ```
2. Delete the experimental branch along with all its changes:
   ```bash
   git branch -D UI-style-experiment
   ```

---

## 4. Option C: Keep and Apply the New UI
If you love your new design and want it to become your main code:

1. Save your final changes on the experiment branch:
   ```bash
   git add .
   git commit -m "Finish new UI redesign"
   ```
2. Switch back to `main`:
   ```bash
   git checkout main
   ```
3. Merge the experiment changes into `main`:
   ```bash
   git merge UI-style-experiment
   ```
4. (Optional) Delete the experiment branch now that it's merged:
   ```bash
   git branch -d UI-style-experiment
   ```
