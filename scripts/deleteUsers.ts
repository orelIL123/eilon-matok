/**
 * סקריפט למחיקה מלאה של משתמשים ספציפיים
 * הפעל עם: npx ts-node scripts/deleteUsers.ts
 */

import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, deleteUser as authDeleteUser } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc, writeBatch } from 'firebase/firestore';

// טעינת .env
dotenv.config();

// Firebase config - קח מ-.env
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// המשתמשים למחיקה
const USERS_TO_DELETE = [
  { name: 'אופק תורגמן' },
  { name: 'עילאי יפרח' },
  { name: 'איתי פתיחה' },
  { phone: '050799877' },
  { phone: '0547222216' }
];

async function deleteUserData(userId: string, userName?: string, userPhone?: string) {
  console.log(`\n🗑️  מוחק נתוני משתמש: ${userName || userPhone || userId}`);

  try {
    // 1. מחיקת כל התורים
    console.log('  📅 מוחק תורים...');
    const appointmentsQuery = query(collection(db, 'appointments'), where('userId', '==', userId));
    const appointmentsSnapshot = await getDocs(appointmentsQuery);

    const batch = writeBatch(db);
    appointmentsSnapshot.docs.forEach((appointmentDoc) => {
      batch.delete(appointmentDoc.ref);
    });
    await batch.commit();
    console.log(`  ✅ נמחקו ${appointmentsSnapshot.size} תורים`);

    // 2. מחיקת push tokens
    console.log('  🔔 מוחק push tokens...');
    const tokensQuery = query(collection(db, 'pushTokens'), where('userId', '==', userId));
    const tokensSnapshot = await getDocs(tokensQuery);

    const tokensBatch = writeBatch(db);
    tokensSnapshot.docs.forEach((tokenDoc) => {
      tokensBatch.delete(tokenDoc.ref);
    });
    await tokensBatch.commit();
    console.log(`  ✅ נמחקו ${tokensSnapshot.size} tokens`);

    // 3. מחיקת מ-Firestore users collection
    console.log('  💾 מוחק מ-Firestore...');
    await deleteDoc(doc(db, 'users', userId));
    console.log('  ✅ נמחק מ-Firestore');

    console.log(`✅ נתוני המשתמש ${userName || userPhone || userId} נמחקו!`);
    console.log(`⚠️  שים לב: לא ניתן למחוק מ-Authentication ללא Admin SDK`);
    console.log(`   יש למחוק ידנית מ-Firebase Console > Authentication`);

    return true;
  } catch (error) {
    console.error(`❌ שגיאה במחיקת ${userName || userPhone || userId}:`, error);
    return false;
  }
}

async function findAndDeleteUser(searchCriteria: { name?: string; phone?: string }) {
  const { name, phone } = searchCriteria;

  console.log(`\n🔍 מחפש משתמש: ${name || phone}`);

  try {
    if (name) {
      // חיפוש לפי שם
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const matchingUsers = usersSnapshot.docs.filter(doc => {
        const userData = doc.data();
        return userData.displayName && userData.displayName.includes(name);
      });

      if (matchingUsers.length === 0) {
        console.log(`  ❌ לא נמצא משתמש עם השם: ${name}`);
        return false;
      }

      console.log(`  ✅ נמצאו ${matchingUsers.length} משתמשים`);

      for (const userDoc of matchingUsers) {
        const userData = userDoc.data();
        console.log(`    - ${userData.displayName} (${userData.phone || 'אין טלפון'})`);
        await deleteUserData(userDoc.id, userData.displayName, userData.phone);
      }

      return true;
    } else if (phone) {
      // חיפוש לפי טלפון
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const phoneFormats = [
        phone,
        `+972${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`,
        `972${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`,
        `0${cleanPhone.startsWith('972') ? cleanPhone.substring(3) : cleanPhone}`,
        cleanPhone
      ];

      let foundUser = null;

      for (const phoneFormat of phoneFormats) {
        const phoneQuery = query(collection(db, 'users'), where('phone', '==', phoneFormat));
        const phoneSnapshot = await getDocs(phoneQuery);

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
      console.log(`  ✅ נמצא: ${userData.displayName} (${userData.phone})`);
      await deleteUserData(foundUser.id, userData.displayName, userData.phone);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ שגיאה:`, error);
    return false;
  }
}

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

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n================================================');
  console.log('📊 סיכום:');
  console.log(`  ✅ נמחקו בהצלחה: ${successCount}`);
  console.log(`  ❌ נכשלו: ${failCount}`);
  console.log('\n⚠️  חשוב: יש למחוק את המשתמשים גם מ:');
  console.log('   Firebase Console > Authentication');
  console.log('   https://console.firebase.google.com/');
  console.log('================================================\n');

  process.exit(0);
}

main().catch(error => {
  console.error('❌ שגיאה:', error);
  process.exit(1);
});
