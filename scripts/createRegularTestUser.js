const admin = require('firebase-admin');

// Load service account
const serviceAccount = require('../eilon-matok-firebase-adminsdk-fbsvc-e152a07891.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createRegularTestUser() {
  console.log('🔐 יצירת משתמש בדיקה רגיל\n');
  
  // Generate unique test user with timestamp
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000000); // 7 digits for phone
  const testUserData = {
    phone: `+97250${String(randomNum).padStart(7, '0')}`, // +972 + 50 (mobile) + 7 digits = 9 digits total
    displayName: `משתמש בדיקה ${randomNum}`,
    email: `testuser${timestamp}@eilonmatok.app`,
    password: 'Test123456!',
  };
  
  try {
    // Check if user already exists by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(testUserData.email);
      console.log('⚠️  המשתמש כבר קיים ב-Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 יוצר משתמש חדש ב-Firebase Auth...');
        userRecord = await auth.createUser({
          email: testUserData.email,
          password: testUserData.password,
          displayName: testUserData.displayName,
          phoneNumber: testUserData.phone,
          emailVerified: true,
        });
        console.log('✅ המשתמש נוצר ב-Firebase Authentication!');
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${testUserData.email}`);
        console.log(`   Phone: ${testUserData.phone}`);
      } else {
        throw error;
      }
    }
    
    const userId = userRecord.uid;
    
    // Check if user document exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      console.log('\n⚠️  מסמך המשתמש כבר קיים ב-Firestore');
      console.log('   מעדכן נתוני משתמש...');
    } else {
      console.log('\n📝 יוצר מסמך משתמש ב-Firestore...');
    }
    
    // Create/update user document in Firestore
    await db.collection('users').doc(userId).set({
      uid: userId,
      email: testUserData.email,
      displayName: testUserData.displayName,
      name: testUserData.displayName,
      phone: testUserData.phone,
      isAdmin: false,
      hasPassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ מסמך המשתמש נוצר/עודכן ב-Firestore');
    
    console.log('\n🎉 יצירת משתמש הבדיקה הושלמה!');
    console.log('\n📋 פרטי התחברות למשתמש בדיקה:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`טלפון:    ${testUserData.phone}`);
    console.log(`אימייל:   ${testUserData.email}`);
    console.log(`סיסמה:    ${testUserData.password}`);
    console.log(`שם:       ${testUserData.displayName}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ משתמש הבדיקה מוכן לשימוש!');
    console.log('\n💡 הערה: משתמש זה הוא משתמש רגיל (לא אדמין) ויכול להתחבר לאפליקציה ולבדוק את כל התכונות.');
    
    // Return credentials for easy copying
    const credentials = {
      phone: testUserData.phone,
      email: testUserData.email,
      password: testUserData.password,
      name: testUserData.displayName,
      uid: userId
    };
    
    console.log('\n📄 פרטי התחברות בפורמט JSON:');
    console.log(JSON.stringify(credentials, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ שגיאה ביצירת משתמש בדיקה:', error);
    if (error.code) {
      console.error(`   קוד שגיאה: ${error.code}`);
    }
    if (error.message) {
      console.error(`   הודעת שגיאה: ${error.message}`);
    }
    process.exit(1);
  }
}

createRegularTestUser();

