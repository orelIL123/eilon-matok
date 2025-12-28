#!/usr/bin/env node

/**
 * Fix Admin User - Make existing user an admin
 * 
 * This script will:
 * 1. Check if user exists
 * 2. Update user document in Firestore to set isAdmin: true
 * 3. Set custom claims for admin access
 * 
 * Usage: node scripts/fixAdminUser.js <UID or email>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-admin-key.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixAdminUser(userIdentifier) {
  console.log('🔧 Fixing Admin User\n');
  console.log(`🔍 Looking for user: ${userIdentifier}\n`);
  
  try {
    let userRecord;
    let userId;
    
    // Try to get user by UID first, then by email
    try {
      userRecord = await auth.getUser(userIdentifier);
      userId = userRecord.uid;
      console.log('✅ Found user by UID');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Try by email
        try {
          userRecord = await auth.getUserByEmail(userIdentifier);
          userId = userRecord.uid;
          console.log('✅ Found user by email');
        } catch (emailError) {
          throw new Error(`User not found: ${userIdentifier}`);
        }
      } else {
        throw error;
      }
    }
    
    console.log(`\n👤 User Details:`);
    console.log(`   UID: ${userId}`);
    console.log(`   Email: ${userRecord.email || 'N/A'}`);
    console.log(`   Phone: ${userRecord.phoneNumber || 'N/A'}`);
    console.log(`   Display Name: ${userRecord.displayName || 'N/A'}`);
    
    // Check current Firestore document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const currentData = userDoc.data();
      console.log(`\n📄 Current Firestore Data:`);
      console.log(`   isAdmin: ${currentData.isAdmin || false}`);
      console.log(`   isBarber: ${currentData.isBarber || false}`);
      console.log(`   displayName: ${currentData.displayName || 'N/A'}`);
    } else {
      console.log(`\n⚠️  User document does NOT exist in Firestore!`);
      console.log(`   Creating new user document...`);
    }
    
    // Update/Create user document in Firestore
    const userDocumentData = {
      uid: userId,
      isAdmin: true,
      isBarber: true,
      hasPassword: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Preserve existing data
    if (userDoc.exists) {
      const existingData = userDoc.data();
      userDocumentData.email = existingData.email || userRecord.email;
      userDocumentData.displayName = existingData.displayName || userRecord.displayName || 'מנהל';
      userDocumentData.name = existingData.name || userDocumentData.displayName;
      userDocumentData.phone = existingData.phone || userRecord.phoneNumber;
      userDocumentData.createdAt = existingData.createdAt || admin.firestore.FieldValue.serverTimestamp();
    } else {
      userDocumentData.email = userRecord.email;
      userDocumentData.displayName = userRecord.displayName || 'מנהל';
      userDocumentData.name = userDocumentData.displayName;
      userDocumentData.phone = userRecord.phoneNumber;
      userDocumentData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await db.collection('users').doc(userId).set(userDocumentData, { merge: true });
    console.log(`\n✅ User document updated in Firestore with isAdmin: true`);
    
    // Set custom claims
    console.log(`\n🔑 Setting custom claims...`);
    await auth.setCustomUserClaims(userId, {
      admin: true,
      barber: true
    });
    console.log(`✅ Custom claims set successfully`);
    
    // Verify the update
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();
    
    console.log(`\n🎉 Admin user fixed successfully!`);
    console.log(`\n📋 Updated User Details:`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`UID:         ${userId}`);
    console.log(`Email:       ${updatedData.email || 'N/A'}`);
    console.log(`Phone:       ${updatedData.phone || 'N/A'}`);
    console.log(`Display Name: ${updatedData.displayName || 'N/A'}`);
    console.log(`isAdmin:     ${updatedData.isAdmin}`);
    console.log(`isBarber:    ${updatedData.isBarber}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ המשתמש הוא עכשיו אדמין!`);
    console.log(`\n💡 חשוב: המשתמש צריך להתנתק ולהתחבר מחדש כדי שהשינויים ייכנסו לתוקף!`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing admin user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Get user identifier from command line argument
const userIdentifier = process.argv[2];

if (!userIdentifier) {
  console.error('❌ Error: User identifier required!');
  console.error('\nUsage: node scripts/fixAdminUser.js <UID or email>');
  console.error('\nExample:');
  console.error('  node scripts/fixAdminUser.js PtpfrLNelaS2SB7ggzdLQuSN0V02');
  console.error('  node scripts/fixAdminUser.js user@example.com');
  process.exit(1);
}

fixAdminUser(userIdentifier);

