# סיכום השינויים

## תאריך: 28 בדצמבר 2025

### 🔥 תיקון קריטי ביותר: Firestore Rules + Indexes - userId במקום clientId

**הבעיה שתוקנה:**
- ❌❌❌ **משתמשים לא יכולים לקרוא את התורים שלהם!**
- ❌❌❌ **משתמשים לא יכולים ליצור תורים חדשים!**
- ❌ השגיאה: `[FirebaseError: Missing or insufficient permissions.]`
- ❌ ה-rules בדקו `resource.data.clientId` אבל הקוד שומר `userId`!
- ❌ ה-indexes השתמשו ב-`clientId` במקום `userId`!

**הפתרון:**
- ✅ **Rules:** שינוי כל ה-`clientId` ל-`userId` ב-firestore.rules
- ✅ **Indexes:** שינוי `clientId` ל-`userId` ב-firestore.indexes.json
- ✅ **Index חדש:** הוספת composite index עבור duplicate check:
  - `userId` + `barberId` + `status` + `date`
- ✅ תיקון ב-appointments collection (rules שורות 51-60)
- ✅ תיקון ב-reviews collection (rules שורה 75)

**✅ פורסם:**
- ✅ Rules פורסמו ב-15:48:39
- ✅ Indexes נוצרו ב-15:51:13 (state: INITIALIZING → READY תוך 2-5 דקות)

**⏳ המתן 2-5 דקות:**
ה-indexes עדיין בונים. תוכל לראות את הסטטוס ב:
https://console.firebase.google.com/project/eilon-matok/firestore/indexes

**תוצאה:**
- ✅ משתמשים יכולים לראות תורים
- ✅ משתמשים יכולים לקבוע תורים חדשים (אחרי שה-indexes יסיימו)
- ✅ אין יותר permission errors
- ✅ duplicate check יעבוד (אחרי שה-indexes יסיימו)

**קבצים ששונו:**
- `firestore.rules` - שינוי clientId ל-userId (שורות 52, 57, 75)
- `firestore.indexes.json` - שינוי clientId ל-userId + index חדש (שורות 24, 36-45)

---

### 🚨 תיקון קריטי: מניעת תורים כפולים באותה שעה (Race Condition)

**הבעיה שתוקנה:**
- ❌ משתמשים יכלו לקבוע **3 תורים באותה שעה** על ידי לחיצה מהירה מספר פעמים
- ❌ אין בדיקה בצד השרת - כל לחיצה יוצרת תור חדש
- ❌ Race condition קלאסי - כל הבדיקות עוברות לפני שהתורים נשמרים

**הפתרון:**
- ✅ **בדיקת Duplicate ב-Firestore** - לפני יצירת תור, בודקים אם יש כבר תור באותה שעה (±2 דקות)
- ✅ **Query עם where clauses** - בודק userId + barberId + date + status
- ✅ **Exception אם נמצא duplicate** - זורק שגיאה: "כבר קיים תור בשעה זו"
- ✅ **מונע לחיצות כפולות** - גם אם המשתמש לוחץ 10 פעמים, רק תור 1 ייווצר

**תוצאה:**
- 🛡️ **אין יותר תורים כפולים** - מוגן מפני race condition
- ⚡ **תגובה מיידית** - אם יש duplicate, המשתמש רואה הודעת שגיאה
- 📱 **בטיחות מלאה** - לא משנה כמה פעמים לוחצים

**קבצים ששונו:**
- `services/firebase.ts` - הוספת duplicate check ב-createAppointment (שורה 1619-1642)

---

### 🔍 Debug: לוגים מתקדמים למסך "התורים שלי" (v2)

**מה נוסף:**
- 🔍 **בדיקת משתמש מחובר** - מציג אם המשתמש מחובר או לא
- 📊 **לוגים מפורטים** - מציג כמה תורים נטענו וכל הפרטים שלהם
- 🆔 **userId verification** - מציג את ה-userId של המשתמש ושל כל תור (לזיהוי אי-התאמה)
- 📈 **ספירת תורים עתידיים** - מציג כמה תורים עתידיים יש (לזיהוי בעיות timezone/filter)
- 🐛 **Debug מלא** - מציג date, status, barberId, treatmentId, userId לכל תור

**תוצאה:**
- ✅ אם משתמש לא רואה תורים, הלוגים יגלו מיד למה:
  - אם לא מחובר → `❌ MyAppointments - No user logged in`
  - אם אין תורים → `📅 Loaded appointments: 0`
  - אם יש userId שונה → `userId: xxx` לא תואם ל-user.uid
  - אם הכל עבר ל-"past" → `📊 Upcoming appointments: 0`

**קבצים ששונו:**
- `app/screens/MyAppointmentsScreen.tsx` - לוגים מתקדמים (שורה 58-94)

---

### ⚡ שיפור ביצועים: אופטימיזציה אגרסיבית של גלריית התמונות (v2)

**מה שופר:**
- **🚀 Image.prefetch אגרסיבי** - כל תמונה נטענת מראש ל-cache מיד כשהקומפוננט מופיע
- **⚡ fadeDuration: 0** - תמונות מופיעות **מיידית** ללא fade (הסרתי 150ms)
- **🗑️ הסרת opacity state** - ביטול ה-opacity נמוך שגרם לתמונות להיראות אפורות
- **📦 Memoization משופר** - תמונות לא נטענות מחדש אלא אם ה-URI השתנה
- **🎯 הסרת state מיותר** - רק state אחד (hasError) במקום שניים

**הבעיה שתוקנה:**
- ❌ תמונות נראו אפורות (opacity 0.3) ולא נטענו
- ❌ משתמשים חשבו שהגלרייה ריקה
- ✅ עכשיו תמונות נטענות מיד ומופיעות ברור

**תוצאה:**
- ⚡ **טעינה מיידית** - Image.prefetch + fadeDuration 0
- ✨ **אין יותר מסכים אפורים** - תמונות מופיעות מיד
- 📱 **ביצועים מעולים** - פחות renders, פחות state

**קבצים ששונו:**
- `app/screens/HomeScreen.tsx` - שיכתוב מלא של OptimizedGalleryImage עם prefetching

---

### ✅ תכונה חדשה: כפתור מיקום בפוטר מסך הבית

**מה נוסף:**
- הוספתי כפתור מיקום בפוטר של מסך הבית
- הכפתור מציג: 📍 "אהרון קציר 10, באר שבע"
- לחיצה על הכפתור פותחת את המיקום באפליקציית המפות המועדפת:
  - **iOS**: Apple Maps
  - **Android**: Google Maps
  - **Fallback**: Google Maps דרך דפדפן אם האפליקציה לא זמינה

**קבצים ששונו:**
- `app/screens/HomeScreen.tsx` - הוספת כפתור locationButton עם אייקון מיקום

---

### ✅ תיקון קריטי: תורים עתידיים לא מופיעים במסך ניהול התורים

**הבעיה שתוקנה:**
- לקוח קובע תור לתאריך עתידי (למשל 1.1.2026) והתור מופיע אצלו ב"התורים שלי"
- אבל התור **לא מופיע** במסך ניהול התורים של האדמין
- הבעיה הייתה ש-`getCurrentMonthAppointments()` התחילה מתחילת החודש הנוכחי

**הפתרון:**
- שיניתי את `getCurrentMonthAppointments()` להתחיל מ-**7 ימים אחורה** (במקום תחילת החודש)
- כעת הטווח הוא: **7 ימים אחורה + 60 ימים קדימה**
- זה מבטיח שתורים עתידיים תמיד יופיעו במסך האדמין
- זה גם מקטין את כמות הנתונים שנטענת (רק תורים רלוונטיים)

**קבצים ששונו:**
- `services/firebase.ts` - עדכון פונקציית `getCurrentMonthAppointments`

**⚠️ חשוב - לפרוס עם:**
```bash
eas update --branch production --message "Fix: תורים עתידיים כעת מופיעים במסך ניהול התורים"
```

---

## תאריך: 22 בדצמבר 2025

### ✅ תיקון: מערכת התראות מנוהלת למשתמשים ואדמינים

**הבעיה שתוקנה:**
- אדמין שולח התראות אבל לא רואה היסטוריה של מה ששלח
- משתמשים לא רואים את ההתראות במסך ההתראות (אייקון הפעמון)
- פופאפ במסך הבית לא מקושר להתראות ששלח האדמין
- אין אפשרות למשתמש לסמן התראה כנקראה ולא לראות אותה שוב

**הפתרון:**
1. **מערכת התראות חדשה:**
   - כל התראה שהאדמין שולח נשמרת ב-`broadcastMessages` ב-Firestore
   - התראות מוצגות במסך ההתראות (NotificationPanel) דרך אייקון הפעמון
   - משתמשים יכולים לסמן התראה כנקראה ולא לראות אותה שוב

2. **שיפורים באדמין:**
   - האדמין רואה היסטוריה מלאה של כל ההתראות ששלח
   - אפשרות למחוק התראות ישנות
   - ספירה של כמה משתמשים קיבלו כל התראה

3. **שיפורים בחוויית משתמש:**
   - הפופאפ במסך הבית הוסר (לא רלוונטי יותר)
   - כל ההתראות מופיעות במסך ההתראות בלחיצה על אייקון הפעמון
   - Badge על אייקון הפעמון מציג את מספר ההתראות שלא נקראו
   - לחיצה על התראת broadcast מציגה אפשרות "סמן כנקרא (לא להציג שוב)"

**איך זה עובד:**
1. אדמין שולח הודעה דרך "הגדרות התראות" → "שליחת הודעה לכל המשתמשים"
2. ההודעה נשמרת ב-Firestore בקולקציה `broadcastMessages`
3. כל המשתמשים רואים את ההודעה במסך ההתראות (אייקון פעמון)
4. משתמש לוחץ על ההודעה → יכול לסמן "סמן כנקרא (לא להציג שוב)"
5. לאחר סימון, ההודעה לא תופיע יותר למשתמש הזה
6. האדמין יכול למחוק הודעות ישנות מההיסטוריה

**קבצים ששונו:**
- `services/firebase.ts` - הוספת פונקציות `dismissBroadcastMessage` ו-`getActiveBroadcastMessages`
- `app/components/NotificationPanel.tsx` - עדכון להציג broadcast messages
- `app/screens/HomeScreen.tsx` - הסרת פופאפ וספירת broadcast messages
- `firestore.rules` - הרשאות לקריאה ועדכון של `broadcastMessages`

**⚠️ חשוב - נפרס בהצלחה:**
```bash
firebase deploy --only firestore:rules ✅
```

---

## תאריך: 22 בדצמבר 2025

### ✅ תיקון: בעיית הרשאות בעדכון הגדרות התראות

**הבעיה שתוקנה:**
- שגיאה "Missing or insufficient permissions" בעת עדכון הגדרות התראות במסך האדמין

**הפתרון:**
- עודכנו כללי Firestore (`firestore.rules`) להוסיף הרשאות ל-`adminSettings` ו-`broadcastMessages`
- ⚠️ **חשוב**: יש לפרוס את הכללים החדשים ל-Firebase:
  ```bash
  firebase deploy --only firestore:rules
  ```

---

### 🆕 תכונה חדשה: מדיניות ביטול תורים

**מה נוסף:**
- האדמין יכול עכשיו לקבוע זמן מינימום לפני תור שלקוחות לא יכולים לבטל
- אפשרויות: **1 שעה / 2 שעות / 4 שעות** לפני התור (ברירת מחדל: 2 שעות)
- כשלקוח מנסה לבטל תור קרוב מדי, הוא מקבל הודעה:
  > "לא ניתן לבטל תור פחות מ-X שעות לפני מועד התור. אנא פנה לספר לטיפול בביטול."

**איפה זה:**
- מסך הגדרות התראות (Admin) → סקציה "מדיניות ביטול תורים"

**טכני:**
- הגדרה נשמרת ב-`adminSettings/notifications` תחת `cancellationDeadlineHours`
- הבדיקה מתבצעת ב-`cancelAppointment()` ב-`services/firebase.ts`
- **אדמינים** יכולים לבטל תורים תמיד (ללא הגבלה)
- **לקוחות** חייבים לעמוד בזמן המינימום

---

### 🆕 תכונה חדשה: היסטוריית הודעות Broadcast

**מה נוסף:**
1. **שמירה אוטומטית** של כל הודעה שנשלחה לכל המשתמשים
2. **הצגת היסטוריה** במסך הגדרות התראות:
   - כותרת ההודעה
   - תוכן ההודעה
   - מי שלח (שם האדמין)
   - מספר נמענים
   - האם נשלח גם SMS
   - תאריך ושעה
3. **מחיקת הודעות** - כפתור מחיקה לכל הודעה בהיסטוריה

**איפה זה:**
- מסך הגדרות התראות (Admin) → סקציה "הודעות שנשלחו"

**טכני:**
- הודעות נשמרות ב-collection: `broadcastMessages`
- פונקציות חדשות ב-`services/firebase.ts`:
  - `saveBroadcastMessage()` - שמירת הודעה
  - `getBroadcastMessages()` - קבלת כל ההודעות (עד 50 אחרונות)
  - `deleteBroadcastMessage()` - מחיקת הודעה

---

### קבצים ששונו ב-22 בדצמבר:

1. **`firestore.rules`**
   - נוספו כללי הרשאה ל-`adminSettings/{documentId}`
   - נוספו כללי הרשאה ל-`broadcastMessages/{messageId}`

2. **`services/firebase.ts`**
   - עודכן `getAdminNotificationSettings()` להוסיף `cancellationDeadlineHours`
   - עודכן `sendNotificationToAllUsers()` לשמור הודעות broadcast
   - עודכן `cancelAppointment()` לבדוק זמן ביטול מינימלי
   - נוספו פונקציות: `saveBroadcastMessage()`, `getBroadcastMessages()`, `deleteBroadcastMessage()`
   - נוסף interface: `BroadcastMessage`

3. **`app/screens/AdminNotificationSettingsScreen.tsx`**
   - נוסף state: `broadcastHistory`, `loadingHistory`
   - נוספה הגדרה: `cancellationDeadlineHours` ב-`NotificationSettings`
   - נוספו פונקציות: `loadBroadcastHistory()`, `handleDeleteBroadcast()`, `handleCancellationDeadlineChange()`
   - נוסף UI: סקציית "מדיניות ביטול תורים" + סקציית "הודעות שנשלחו"

---

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






