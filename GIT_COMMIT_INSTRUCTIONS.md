# הוראות ל-Commit ו-Push

## שלב 1: מחיקת תיקיות ריקות
```bash
chmod +x cleanup-empty-dirs.sh
./cleanup-empty-dirs.sh
```

## שלב 2: בדיקת שינויים
```bash
git status
```

## שלב 3: הוספת כל השינויים
```bash
git add -A
```

## שלב 4: Commit
```bash
git commit -m "Cleanup: Remove unused files and directories

- Remove naor-amar project directory
- Remove firebase_functions duplicate directory  
- Remove components/ directory (old unused components)
- Remove all documentation markdown files (except README.md)
- Remove duplicate GoogleService-Info plist files
- Remove duplicate image files (splash.png, icon_booking.png)
- Remove unused files (privacy-policy.html, hooks/icon.png, firebase-debug.log)
- Fix +not-found.tsx to not use ThemedText/ThemedView
- Keep public/ directory for Firebase hosting
- Keep legal/ directory for terms and privacy policy"
```

## שלב 5: Push
```bash
git push
```

## שלב 6: ניקוי (אופציונלי)
```bash
rm cleanup-empty-dirs.sh
rm GIT_COMMIT_INSTRUCTIONS.md
git add -A
git commit -m "Remove temporary cleanup scripts"
git push
```
