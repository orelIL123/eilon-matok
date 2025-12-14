#!/bin/bash

# סקריפט לעדכון תמונת הספלאש אחרי שמירת eilon-matok-splash.png

echo "🔍 בודק אם התמונה eilon-matok-splash.png קיימת..."

if [ -f "assets/images/eilon-matok-splash.png" ]; then
    echo "✅ התמונה נמצאה!"
    echo ""
    echo "📝 מעדכן את הקבצים..."
    
    # עדכון app/splash.tsx
    sed -i '' 's|naoramar\.png|eilon-matok-splash.png|g' app/splash.tsx
    sed -i '' 's|resizeMode="cover"|resizeMode="contain"|g' app/splash.tsx
    sed -i '' "s|backgroundColor: '#000'|backgroundColor: '#E8E8E8'|g" app/splash.tsx
    
    # עדכון app.json
    sed -i '' 's|"image": "./assets/images/splash.png"|"image": "./assets/images/eilon-matok-splash.png"|g' app.json
    sed -i '' 's|"resizeMode": "cover"|"resizeMode": "contain"|g' app.json
    sed -i '' 's|"backgroundColor": "#000000"|"backgroundColor": "#E8E8E8"|g' app.json
    
    echo "✅ הקבצים עודכנו בהצלחה!"
    echo ""
    echo "🧹 מנקה cache..."
    npx expo start --clear
    
else
    echo "❌ התמונה eilon-matok-splash.png לא נמצאה!"
    echo "אנא שמור אותה ב: assets/images/eilon-matok-splash.png"
    exit 1
fi

