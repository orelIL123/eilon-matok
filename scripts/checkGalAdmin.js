/**
 * Check eilon matok Admin User
 */

const admin = require('firebase-admin');

// Load service account
const serviceAccount = require('../gal-shemesh-firebase-adminsdk-fbsvc-a1bc48ced4.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function checkGalAdmin() {
  console.log('🔍 Checking eilon matok admin user...\n');
  
  const galUID = 'CjSmO9Irz1czF1U7R12M9stGbf93';
  
  // Check Firebase Auth
  console.log('📧 Checking Firebase Auth...');
  try {
    const authUser = await auth.getUser(galUID);
    console.log('✅ Found in Firebase Auth:');
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Display Name: ${authUser.displayName}`);
    console.log(`   Custom Claims: ${JSON.stringify(authUser.customClaims)}`);
  } catch (error) {
    console.log('❌ Not found in Firebase Auth:', error.message);
  }
  
  // Check Firestore
  console.log('\n📄 Checking Firestore users collection...');
  try {
    const userDoc = await db.collection('users').doc(galUID).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      console.log('✅ Found in Firestore:');
      console.log(`   Document ID: ${userDoc.id}`);
      console.log(`   Name: ${data.name || data.displayName}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Phone: ${data.phone}`);
      console.log(`   isAdmin: ${data.isAdmin}`);
      console.log(`   isBarber: ${data.isBarber}`);
    } else {
      console.log('❌ User document NOT found in Firestore!');
    }
  } catch (error) {
    console.log('❌ Error checking Firestore:', error.message);
  }
  
  // Also check by phone number
  console.log('\n🔍 Searching users by phone...');
  try {
    const snapshot = await db.collection('users')
      .where('phone', '==', '+972522210281')
      .get();
    
    if (snapshot.empty) {
      console.log('❌ No users found with phone +972522210281');
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`✅ Found user with phone:`)
        console.log(`   Document ID: ${doc.id}`);
        console.log(`   Name: ${data.name || data.displayName}`);
        console.log(`   isAdmin: ${data.isAdmin}`);
      });
    }
  } catch (error) {
    console.log('❌ Error searching by phone:', error.message);
  }
  
  process.exit(0);
}

checkGalAdmin();

