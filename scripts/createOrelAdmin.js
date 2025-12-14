/**
 * Create Admin User: orel895@gmail.com
 * This creates a user in Firebase Auth and links it to Firestore
 * 
 * Usage: node scripts/createOrelAdmin.js
 * 
 * Note: Update the serviceAccountKey.json path as needed
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account - update path as needed
// const serviceAccount = require('../path/to/serviceAccountKey.json');
// For now, this script may need to be updated with the correct service account path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createOrelAdmin() {
  console.log('🔐 Creating Admin User: orel895@gmail.com\n');
  
  const adminData = {
    email: 'orel895@gmail.com',
    password: '123456',
    displayName: 'Orel Aharon',
    phone: '+972501234567', // Optional - can be updated later
  };
  
  try {
    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminData.email);
      console.log('⚠️  User already exists in Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Phone: ${userRecord.phoneNumber || 'Not set'}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user...');
        userRecord = await auth.createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.displayName,
          phoneNumber: adminData.phone,
          emailVerified: true,
        });
        console.log('✅ User created in Firebase Authentication!');
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Password: ${adminData.password}`);
      } else {
        throw error;
      }
    }
    
    const userId = userRecord.uid;
    
    // Check if user document exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      console.log('\n⚠️  User document already exists in Firestore');
      console.log('   Updating admin status...');
    } else {
      console.log('\n📝 Creating user document in Firestore...');
    }
    
    // Create/update user document in Firestore
    await db.collection('users').doc(userId).set({
      uid: userId,
      email: adminData.email,
      displayName: adminData.displayName,
      name: adminData.displayName,
      phone: adminData.phone,
      phoneE164: adminData.phone,
      isAdmin: true,
      isBarber: false, // Can be changed to true if needed
      hasPassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ User document created/updated in Firestore');
    
    // Set custom claims for admin access
    console.log('\n🔑 Setting custom claims...');
    await auth.setCustomUserClaims(userId, {
      admin: true
    });
    console.log('✅ Custom claims set successfully');
    
    console.log('\n🎉 Admin user setup complete!');
    console.log('\n📋 Login Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ User is now an admin and can log in!');
    
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

createOrelAdmin();

