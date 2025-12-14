#!/usr/bin/env node
/**
 * Initialize Firebase Services for Eilon Matok
 * Creates Firestore database, enables services, and sets up collections
 */

const admin = require('firebase-admin');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load service account
const serviceAccount = require('../firebase-admin-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
});

const db = admin.firestore();
const storage = admin.storage();

console.log('\n🔥🔥🔥 Firebase Services Initialization - Eilon Matok 🔥🔥🔥\n');

async function createFirestoreCollections() {
  console.log('📚 Creating Firestore Collections...\n');

  try {
    // 1. Business Settings
    console.log('🏢 Creating businessSettings...');
    await db.collection('businessSettings').doc('main').set({
      businessName: 'Eilon Matok',
      ownerName: 'Eilon Matok',
      phone: '+972508315002',
      email: 'eilonmatok905@gmail.com',
      address: 'באר שבע',
      primaryColor: '#8B4513',
      description: 'ברוכים הבאים ל-Eilon Matok',
      workingHours: {
        sunday: { open: '09:00', close: '20:00', isOpen: true },
        monday: { open: '09:00', close: '20:00', isOpen: true },
        tuesday: { open: '09:00', close: '20:00', isOpen: true },
        wednesday: { open: '09:00', close: '20:00', isOpen: true },
        thursday: { open: '09:00', close: '20:00', isOpen: true },
        friday: { open: '08:00', close: '14:00', isOpen: true },
        saturday: { open: '00:00', close: '00:00', isOpen: false }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ businessSettings created\n');

    // 2. Treatments
    console.log('💈 Creating treatments...');
    const treatments = [
      {
        id: 'haircut',
        name: 'תספורת',
        nameEn: 'Haircut',
        duration: 30,
        price: 80,
        description: 'תספורת גברים מקצועית',
        isActive: true,
        order: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'smoothing',
        name: 'החלקה',
        nameEn: 'Hair Smoothing',
        duration: 120,
        price: 300,
        description: 'החלקת שיער לנשים',
        isActive: true,
        order: 2,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    for (const treatment of treatments) {
      await db.collection('treatments').doc(treatment.id).set(treatment);
      console.log(`  ✅ ${treatment.name}`);
    }
    console.log('✅ All treatments created\n');

    // 3. Barber
    console.log('💇 Creating barber...');
    await db.collection('barbers').doc('barber_1').set({
      barberId: 'barber_1',
      name: 'אילון מתוק',
      phone: '+972508315002',
      email: 'eilonmatok901@gmail.com',
      specialization: 'תספורת, החלקות לנשים',
      experience: '',
      isMainBarber: true,
      available: true,
      isActive: true,
      userId: 'user_eilon_matok_barber_1',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Barber created\n');

    // 4. Initialize empty collections with placeholder docs
    console.log('📦 Initializing collections...');

    const collections = [
      'appointments',
      'users',
      'gallery',
      'notifications',
      'reviews',
      'statistics',
      'waitlist'
    ];

    for (const collectionName of collections) {
      await db.collection(collectionName).doc('_placeholder').set({
        _placeholder: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  ✅ ${collectionName}`);
    }
    console.log('✅ All collections initialized\n');

    // 5. Create indexes
    console.log('📇 Collections ready for indexes...\n');

    console.log('✅ Firestore setup completed!\n');

  } catch (error) {
    console.error('❌ Error creating collections:', error);
    throw error;
  }
}

async function createStorageBuckets() {
  console.log('🗄️  Setting up Storage...\n');

  try {
    const bucket = storage.bucket();

    // Create folder structure by uploading placeholder files
    const folders = [
      'gallery',
      'barbers',
      'treatments',
      'users'
    ];

    for (const folder of folders) {
      const file = bucket.file(`${folder}/.placeholder`);
      await file.save('placeholder', {
        metadata: {
          contentType: 'text/plain'
        }
      });
      console.log(`  ✅ ${folder}/`);
    }

    console.log('✅ Storage buckets created\n');
  } catch (error) {
    console.error('⚠️  Storage setup warning:', error.message);
    console.log('ℹ️  Storage may need manual activation in console\n');
  }
}

async function deployFirebaseRules() {
  console.log('🔒 Deploying Firebase Rules and Indexes...\n');

  try {
    // Deploy Firestore rules
    console.log('📜 Deploying Firestore rules...');
    const { stdout: firestoreOut } = await execPromise('firebase deploy --only firestore:rules');
    console.log('✅ Firestore rules deployed\n');

    // Deploy Firestore indexes
    console.log('📇 Deploying Firestore indexes...');
    const { stdout: indexesOut } = await execPromise('firebase deploy --only firestore:indexes');
    console.log('✅ Firestore indexes deployed\n');

    // Deploy Storage rules
    console.log('🗄️  Deploying Storage rules...');
    const { stdout: storageOut } = await execPromise('firebase deploy --only storage');
    console.log('✅ Storage rules deployed\n');

  } catch (error) {
    console.error('⚠️  Deployment warning:', error.message);
    console.log('ℹ️  You may need to run: firebase deploy --only firestore,storage\n');
  }
}

async function main() {
  try {
    console.log(`🎯 Project: ${serviceAccount.project_id}\n`);

    // Step 1: Create Firestore collections
    await createFirestoreCollections();

    // Step 2: Setup Storage
    await createStorageBuckets();

    // Step 3: Deploy rules and indexes
    await deployFirebaseRules();

    console.log('🎉🎉🎉 Firebase Services Initialized Successfully! 🎉🎉🎉\n');
    console.log('📝 Next Steps:');
    console.log('   1. Check Firestore: https://console.firebase.google.com/project/eilon-matok/firestore');
    console.log('   2. Check Storage: https://console.firebase.google.com/project/eilon-matok/storage');
    console.log('   3. Enable Authentication (Email + Phone) in console');
    console.log('   4. Run: npm start\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  }
}

main();
