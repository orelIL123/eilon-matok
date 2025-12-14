/**
 * סקריפט למחיקה מלאה של משתמשים ספציפיים
 * מוחק מ:
 * 1. Firebase Authentication
 * 2. Firestore users collection
 * 3. Push notification tokens
 * 4. כל התורים שלהם
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://barber-app-d1771.firebaseio.com"
});

const db = admin.firestore();
const auth = admin.auth();

// המשתמשים למחיקה
const USERS_TO_DELETE = [
  { name: 'אופק תורגמן', phone: null },
  { name: 'עילאי יפרח', phone: null },
  { name: 'איתי פתיחה', phone: null },
  { name: null, phone: '050799877' },
  { name: null, phone: '0547222216' }
];

// פונקציה למחיקת משתמש מלאה
async function deleteUserCompletely(userId, userName, userPhone) {
  console.log(`\n🗑️  מוחק משתמש: ${userName || userPhone || userId}`);

  try {
    // 1. מחיקת כל התורים של המשתמש
    console.log('  📅 מוחק תורים...');
    const appointmentsQuery = db.collection('appointments').where('userId', '==', userId);
    const appointmentsSnapshot = await appointmentsQuery.get();

    const batch = db.batch();
    appointmentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`  ✅ נמחקו ${appointmentsSnapshot.size} תורים`);

    // 2. מחיקת push tokens
    console.log('  🔔 מוחק push tokens...');
    const tokensQuery = db.collection('pushTokens').where('userId', '==', userId);
    const tokensSnapshot = await tokensQuery.get();

    const tokensBatch = db.batch();
    tokensSnapshot.docs.forEach(doc => {
      tokensBatch.delete(doc.ref);
    });
    await tokensBatch.commit();
    console.log(`  ✅ נמחקו ${tokensSnapshot.size} tokens`);

    // 3. מחיקת מ-Firestore users collection
    console.log('  💾 מוחק מ-Firestore...');
    await db.collection('users').doc(userId).delete();
    console.log('  ✅ נמחק מ-Firestore');

    // 4. מחיקת מ-Firebase Authentication
    console.log('  🔐 מוחק מ-Authentication...');
    try {
      await auth.deleteUser(userId);
      console.log('  ✅ נמחק מ-Authentication');
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        console.log('  ⚠️  לא נמצא ב-Authentication (כבר נמחק או לא קיים)');
      } else {
        throw authError;
      }
    }

    console.log(`✅ המשתמש ${userName || userPhone || userId} נמחק לגמרי!`);
    return true;
  } catch (error) {
    console.error(`❌ שגיאה במחיקת ${userName || userPhone || userId}:`, error);
    return false;
  }
}

// פונקציה לחיפוש משתמש לפי שם או טלפון
async function findAndDeleteUser(searchCriteria) {
  const { name, phone } = searchCriteria;

  console.log(`\n🔍 מחפש משתמש: ${name || phone}`);

  try {
    let usersQuery;

    if (name) {
      // חיפוש לפי שם (חיפוש חלקי)
      usersQuery = db.collection('users');
      const snapshot = await usersQuery.get();

      const matchingUsers = snapshot.docs.filter(doc => {
        const userData = doc.data();
        return userData.displayName && userData.displayName.includes(name);
      });

      if (matchingUsers.length === 0) {
        console.log(`  ❌ לא נמצא משתמש עם השם: ${name}`);
        return false;
      }

      console.log(`  ✅ נמצאו ${matchingUsers.length} משתמשים`);

      // מחיקת כל המשתמשים שנמצאו
      for (const userDoc of matchingUsers) {
        const userData = userDoc.data();
        await deleteUserCompletely(userDoc.id, userData.displayName, userData.phone);
      }

      return true;
    } else if (phone) {
      // חיפוש לפי טלפון (כל הפורמטים האפשריים)
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const phoneFormats = [
        phone,
        `+972${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`,
        `972${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`,
        `0${cleanPhone.startsWith('972') ? cleanPhone.substring(3) : cleanPhone}`,
        cleanPhone
      ];

      console.log(`  🔍 מחפש בפורמטים: ${phoneFormats.join(', ')}`);

      let foundUser = null;

      for (const phoneFormat of phoneFormats) {
        const phoneQuery = db.collection('users').where('phone', '==', phoneFormat);
        const phoneSnapshot = await phoneQuery.get();

        if (!phoneSnapshot.empty) {
          foundUser = phoneSnapshot.docs[0];
          break;
        }
      }

      if (!foundUser) {
        console.log(`  ❌ לא נמצא משתמש עם הטלפון: ${phone}`);
        return false;
      }

      const userData = foundUser.data();
      console.log(`  ✅ נמצא משתמש: ${userData.displayName} (${userData.phone})`);

      await deleteUserCompletely(foundUser.id, userData.displayName, userData.phone);
      return true;
    }
  } catch (error) {
    console.error(`❌ שגיאה בחיפוש/מחיקה:`, error);
    return false;
  }
}

// הרצת הסקריפט
async function main() {
  console.log('🚀 מתחיל מחיקת משתמשים...\n');
  console.log('================================================');

  let successCount = 0;
  let failCount = 0;

  for (const user of USERS_TO_DELETE) {
    const success = await findAndDeleteUser(user);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // המתנה קצרה בין מחיקות
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n================================================');
  console.log('📊 סיכום:');
  console.log(`  ✅ נמחקו בהצלחה: ${successCount}`);
  console.log(`  ❌ נכשלו: ${failCount}`);
  console.log('================================================\n');

  process.exit(0);
}

main().catch(error => {
  console.error('❌ שגיאה כללית:', error);
  process.exit(1);
});
