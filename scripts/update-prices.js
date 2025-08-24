// Firebase Admin SDK ইম্পোর্ট করা হচ্ছে
const admin = require('firebase-admin');

// GitHub Actions থেকে পাওয়া সার্ভিস অ্যাকাউন্ট কী এবং ডাটাবেজ URL ব্যবহার করা হচ্ছে
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

// প্রয়োজনীয় তথ্য আছে কিনা তা পরীক্ষা করা হচ্ছে
if (!serviceAccountKey || !databaseURL) {
  console.error('Firebase SERVICE ACCOUNT KEY বা DATABASE URL পাওয়া যায়নি। GitHub Actions Workflow ফাইলটি চেক করুন।');
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
  // 'products' পাথে সব পণ্যের দাম সেভ হবে
  const ref = db.ref('products');

  // আপনার পণ্যের তালিকা
  const samplePrices = {
    'মিনিকেট চাল': { lowest: 72, highest: 80 },
    'মসুর ডাল': { lowest: 135, highest: 145 },
    'সয়াবিন তেল': { lowest: 160, highest: 165 },
    'আলু': { lowest: 45, highest: 55 },
    'পেঁয়াজ': { lowest: 85, highest: 95 },
    'গরুর মাংস': { lowest: 780, highest: 800 },
    'খাসির মাংস': { lowest: 1100, highest: 1180 },
    'মুরগির মাংস (ব্রয়লার)': { lowest: 210, highest: 230 },
    'মুরগির ডিম': { lowest: 48, highest: 52 },
    'ইলিশ মাছ': { lowest: 1300, highest: 1850 },
    'রুই মাছ': { lowest: 380, highest: 480 },
  };

  // প্রতিটি পণ্যের জন্য দাম কিছুটা পরিবর্তন করা হচ্ছে
  for (const product in samplePrices) {
    const randomChange = Math.floor(Math.random() * 5) - 2; // -2 থেকে +2 এর মধ্যে পরিবর্তন
    samplePrices[product].lowest += randomChange;
    samplePrices[product].highest += randomChange;
  }
  
  const lastUpdated = new Date().toISOString();
  const dataToUpdate = {
      prices: samplePrices,
      lastUpdated: lastUpdated
  };

  // সম্পূর্ণ নতুন তালিকাটি Firebase-এ পাঠানো হচ্ছে
  ref.set(dataToUpdate)
    .then(() => {
      console.log(`সফলভাবে Firebase এ ${Object.keys(samplePrices).length} টি পণ্যের দাম আপডেট করা হয়েছে।`);
      console.log('আপডেট হওয়া ডেটা:', JSON.stringify(dataToUpdate, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Firebase এ ডেটা লিখতে সমস্যা হয়েছে:', error);
      process.exit(1);
    });

} catch (error) {
  console.error('Firebase ইনিশিয়ালাইজ করতে সমস্যা হয়েছে:', error.message);
  process.exit(1);
        }
