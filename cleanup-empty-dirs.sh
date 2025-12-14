#!/bin/bash
# מחיקת תיקיות ריקות
cd "$(dirname "$0")"

# מחיקת תיקיות ריקות
if [ -d "components" ] && [ -z "$(ls -A components)" ]; then
  rm -rf components
  echo "✅ נמחקה תיקייה components/"
fi

echo "✅ ניקוי הושלם!"
