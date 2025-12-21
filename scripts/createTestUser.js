const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccount = require('../eilon-matok-firebase-adminsdk-fbsvc-e152a07891.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createTestUser() {
  console.log('🔐 Creating Test User for Apple TestFlight\n');
  
  const testUserData = {
    phone: '+972500000000',
    displayName: 'Test User',
    email: 'test@eilonmatok.app',
    password: 'TestApple123!',
  };
  
  try {
    // Check if user already exists by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(testUserData.email);
      console.log('⚠️  User already exists in Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new test user in Firebase Auth...');
        userRecord = await auth.createUser({
          email: testUserData.email,
          password: testUserData.password,
          displayName: testUserData.displayName,
          phoneNumber: testUserData.phone,
          emailVerified: true,
        });
        console.log('✅ User created in Firebase Authentication!');
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
      console.log('\n⚠️  User document already exists in Firestore');
      console.log('   Updating user data...');
    } else {
      console.log('\n📝 Creating user document in Firestore...');
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
    
    console.log('✅ User document created/updated in Firestore');
    
    console.log('\n🎉 Test user setup complete!');
    console.log('\n📋 פרטי התחברות למשתמש טסט:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`טלפון:    ${testUserData.phone}`);
    console.log(`אימייל:   ${testUserData.email}`);
    console.log(`סיסמה:    ${testUserData.password}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ משתמש הטסט מוכן לשימוש ב-TestFlight!');
    console.log('\n💡 הערה: משתמש זה יכול להתחבר לאפליקציה ולבדוק את כל התכונות.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating test user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    process.exit(1);
  }
}

createTestUser();

