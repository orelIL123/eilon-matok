const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { getStorage, ref, listAll, getDownloadURL } = require('firebase/storage');

const firebaseConfig = {
  apiKey: "AIzaSyBiDFQNbnExTE03YS_6xoNE6_RrX4HBN4Q",
  authDomain: "barber-app-template.firebaseapp.com",
  projectId: "barber-app-template",
  storageBucket: "barber-app-template.firebasestorage.app",
  messagingSenderId: "246646930767",
  appId: "1:246646930767:web:d1bdd3b156eda443f2193a",
  measurementId: "G-S6VSPNP5LH"
};

(async () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const shopRef = ref(storage, 'shop');
  const result = await listAll(shopRef);
  const urls = await Promise.all(result.items.map(async (imageRef) => {
    return await getDownloadURL(imageRef);
  }));
  console.log(`נמצאו ${urls.length} תמונות ב-Firebase Storage/shop`);
  
  for (let i = 0; i < urls.length; i++) {
    await addDoc(collection(db, 'shopItems'), {
      name: `מוצר מספר ${i + 1}`,
      description: 'מוצר איכותי למספרה',
      price: 50 + (i * 10), // מחירים שונים
      category: 'מוצרי טיפוח',
      imageUrl: urls[i],
      isActive: true,
      stock: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ מוצר ${i + 1} נוסף לקולקשן shopItems!`);
  }
  process.exit(0);
})(); 