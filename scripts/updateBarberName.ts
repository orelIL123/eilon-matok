/**
 * סקריפט לעדכון שמות ספרים ב-Firebase
 * 
 * שימוש:
 * ts-node scripts/updateBarberName.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateBarberNames() {
  try {
    console.log('🔍 מחפש ספרים לעדכון...');
    
    // קבל את כל הספרים
    const barbersSnapshot = await getDocs(collection(db, 'barbers'));
    
    let updatedCount = 0;
    
    for (const barberDoc of barbersSnapshot.docs) {
      const barberData = barberDoc.data();
      const oldName = barberData.name;
      
      // בדוק אם השם הוא "נאור עמר" או וריאציות שלו
      if (
        oldName === 'נאור עמר' ||
        oldName === 'Naor Amar' ||
        oldName === 'naor amar' ||
        oldName === 'Naor amar' ||
        oldName?.includes('נאור עמר') ||
        oldName?.includes('Naor Amar') ||
        oldName?.includes('naor amar')
      ) {
        console.log(`📝 מעדכן ספר: "${oldName}" → "אילון מתוק"`);
        
        const barberRef = doc(db, 'barbers', barberDoc.id);
        await updateDoc(barberRef, {
          name: 'אילון מתוק'
        });
        
        updatedCount++;
        
        // עדכן גם במסמך users אם יש
        if (barberData.barberId) {
          const usersQuery = query(
            collection(db, 'users'),
            where('barberId', '==', barberData.barberId)
          );
          const usersSnapshot = await getDocs(usersQuery);
          
          for (const userDoc of usersSnapshot.docs) {
            const userRef = doc(db, 'users', userDoc.id);
            await updateDoc(userRef, {
              name: 'אילון מתוק'
            });
            console.log(`   ✅ עודכן גם ב-users: ${userDoc.id}`);
          }
        }
      }
    }
    
    console.log(`\n✅ עדכון הושלם! עודכנו ${updatedCount} ספרים.`);
    
    if (updatedCount === 0) {
      console.log('ℹ️  לא נמצאו ספרים שצריך לעדכן.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ שגיאה בעדכון הספרים:', error);
    process.exit(1);
  }
}

updateBarberNames();

