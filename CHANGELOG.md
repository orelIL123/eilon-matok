# סיכום השינויים

## תאריך: 21 בדצמבר 2025

### 1. תיקון מסך הפרופיל
- **הסרת מסך ההתחברות/הרשמה** מ-ProfileScreen
- המשתמש מועבר אוטומטית ל-`/auth-choice` אם לא מחובר
- ניקוי קוד וסגנונות לא נחוצים

### 2. יצירת משתמש אדמין לאילון
- נוצר סקריפט `scripts/createEilonAdmin.js`
- **פרטי התחברות:**
  - מספר טלפון: `0508315002` או `+972508315002`
  - סיסמה: `112233`
  - UID: `6XVviL49bMdNtCsQ1JuXRnD1qao1`
- המשתמש מוגדר כ-admin, barber, עם custom claims

### 3. עדכון רשתות חברתיות
- **אינסטגרם:** עודכן ל-`https://www.instagram.com/eilonmatok7?igsh=MWlwaDl4cjRocWFpbQ==`
- **פייסבוק:** הוסר מהמסך הראשי (אין לו)

### 4. קישור וואטסאפ לכפתור "Powered by Orel Aharon"
- לחיצה על הכפתור פותחת וואטסאפ למספר `0523985505`

### 5. הסרת מיקום ונווט מוויז
- הוסר טקסט המיקום "באר שבע" מהפוטר
- הוסר כפתור "נווט עם Waze"
- בפוטר נשאר רק קרדיט ותנאי שימוש

### 6. תיקון בעיית העלאת תמונות לגלריה
- **תיקון Firestore Rules:** איפשר קריאה מה-users collection (`allow get: if true`)
- **תיקון Storage Rules:**
  - הוספת בדיקת `firestore.exists()` לפני קריאה
  - הוספת fallback function `isKnownAdmin()` עם UID ספציפי
  - הפרדת create/update/delete לשליטה טובה יותר
- **שיפור טיפול בשגיאות:** הודעות שגיאה ברורות יותר
- **לוגים מפורטים:** הוספת לוגים לניפוי באגים

### 7. שיפור מסך הזמינות (AdminAvailabilityScreen)
- **הוספת אייקון מספריים עם אנימציה במודאל:**
  - מציג `ScissorsLoader` כשהמודאל טוען נתונים
  - טקסט "טוען זמינות..." מתחת לאייקון
- **שיפור ביצועים:**
  - המסך הראשי נפתח מיד (ללא המתנה לטעינת הספרים)
  - המודאל נפתח מיד עם מצב טעינה
  - הנתונים נטענים ברקע
  - שיפור בטעינת הספרים - מציג loading רק בטעינה ראשונית

### 8. שיפור מחיקת תמונות מהגלריה
- מחיקת תמונה מ-Firestore גם מוחקת אותה מ-Firebase Storage
- הוספת כפתור מחיקה מ-Storage במסך הגלריה

### קבצים שעודכנו:
- `app/screens/ProfileScreen.tsx`
- `app/screens/HomeScreen.tsx`
- `app/screens/AdminGalleryScreen.tsx`
- `app/screens/AdminAvailabilityScreen.tsx`
- `app/config/firebase.ts`
- `app/booking.tsx`
- `storage.rules`
- `firestore.rules`
- `services/firebase.ts`
- `scripts/createEilonAdmin.js`
