// Firebase Admin SDK ইম্পোর্ট করা হচ্ছে
const admin = require('firebase-admin');

// GitHub Actions থেকে পাওয়া সার্ভিস অ্যাকাউন্ট কী এবং ডাটাবেজ URL ব্যবহার করা হচ্ছে
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!serviceAccountKey || !databaseURL) {
  console.error('Firebase SERVICE ACCOUNT KEY বা DATABASE URL পাওয়া যায়নি।');
  process.exit(1);
}

try {
  // Firebase অ্যাপ ইনিশিয়ালাইজ করা হচ্ছে
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
    databaseURL: databaseURL
  });
  console.log('Firebase Admin SDK সফলভাবে ইনিশিয়ালাইজ হয়েছে।');

  const db = admin.database();
  const ref = db.ref('products'); // ডাটাবেজের 'products' শাখা

  // ধাপ ১: প্রথমে Firebase থেকে বর্তমান পণ্যের তালিকা পড়া হচ্ছে
  ref.once('value', (snapshot) => {
    const productsData = snapshot.val();
    
    // যদি ডাটাবেজে কোনো পণ্য না থাকে, তাহলে কাজটি এখানেই শেষ
    if (!productsData || !productsData.prices) {
      console.log('ডাটাবেজে কোনো পণ্য পাওয়া যায়নি। আপডেট করার কিছু নেই।');
      process.exit(0);
      return;
    }

    const currentPrices = productsData.prices;
    const updatedPrices = {};
    let updatedCount = 0;

    // ধাপ ২: প্রতিটি পণ্যের দামে র‍্যান্ডম পরিবর্তন আনা হচ্ছে
    for (const productName in currentPrices) {
      const product = currentPrices[productName];
      // -2 থেকে +2 এর মধ্যে একটি র‍্যান্ডম সংখ্যা তৈরি করা হচ্ছে
      const randomChange = Math.floor(Math.random() * 5) - 2;

      // পণ্যের অন্যান্য সব তথ্য (unit, image_url ইত্যাদি) অপরিবর্তিত রাখা হচ্ছে
      updatedPrices[productName] = {
        ...product, 
        lowest_price: (product.lowest_price || 0) + randomChange,
        highest_price: (product.highest_price || 0) + randomChange,
      };
      updatedCount++;
    }
    
    const dataToUpdate = {
        prices: updatedPrices,
        lastUpdated: new Date().toISOString()
    };

    // ধাপ ৩: সম্পূর্ণ নতুন তালিকাটি Firebase-এ পাঠানো হচ্ছে
    // এই পদ্ধতিতে ইউজারদের যোগ করা পণ্য মুছে যাবে না, কারণ আমরা শুরুতেই সেগুলো পড়ে নিয়েছি।
    ref.set(dataToUpdate)
      .then(() => {
        console.log(`সফলভাবে Firebase এ ${updatedCount} টি পণ্যের দাম আপডেট করা হয়েছে।`);
        process.exit(0);
      })
      .catch((error) => {
        console.error('Firebase এ ডেটা লিখতে সমস্যা হয়েছে:', error);
        process.exit(1);
      });

  }, (errorObject) => {
    console.error('Firebase থেকে ডেটা পড়তে সমস্যা হয়েছে: ' + errorObject.code);
    process.exit(1);
  });

} catch (error) {
  console.error('Firebase ইনিশিয়ালাইজ করতে সমস্যা হয়েছে:', error.message);
  process.exit(1);
      }
