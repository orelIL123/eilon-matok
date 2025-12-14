/**
 * Create Admin User: App Review
 * Email: appreview@yourdomain.com
 * Password: AppReview123!
 * Role: admin
 * 
 * Usage: node scripts/createAppReviewAdmin.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account
const serviceAccount = require('../gal-shemesh-firebase-adminsdk-fbsvc-a1bc48ced4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createAppReviewAdmin() {
  console.log('🔐 Creating Admin User: App Review\n');
  
  const adminData = {
    email: 'appreview@yourdomain.com',
    password: 'AppReview123!',
    displayName: 'App Review Admin',
  };
  
  try {
    // Check if user already exists by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminData.email);
      console.log('⚠️  User already exists in Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user in Firebase Auth...');
        userRecord = await auth.createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.displayName,
          emailVerified: true,
        });
        console.log('✅ User created in Firebase Authentication!');
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${adminData.email}`);
      } else {
        throw error;
      }
    }
    
    const userId = userRecord.uid;
    
    // Check if user document exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      console.log('\n⚠️  User document already exists in Firestore');
      console.log('   Updating to admin status...');
    } else {
      console.log('\n📝 Creating user document in Firestore...');
    }
    
    // Create/update user document in Firestore
    await db.collection('users').doc(userId).set({
      uid: userId,
      email: adminData.email,
      displayName: adminData.displayName,
      name: adminData.displayName,
      isAdmin: true,
      isBarber: true, // Give full access - admin can access all parts
      hasPassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ User document created/updated in Firestore');
    
    // Set custom claims for admin access
    console.log('\n🔑 Setting custom claims...');
    await auth.setCustomUserClaims(userId, {
      admin: true,
      barber: true
    });
    console.log('✅ Custom claims set successfully');
    
    console.log('\n🎉 Admin user setup complete!');
    console.log('\n📋 Login Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ App Review Admin is now set up and can log in!');
    console.log('   This admin has full access to all admin features.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    process.exit(1);
  }
}

createAppReviewAdmin();
