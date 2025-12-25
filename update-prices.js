const admin = require('firebase-admin');

// GitHub Secrets থেকে ফায়ারবেস একাউন্ট এর তথ্য নেওয়া হচ্ছে
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amar-bazar-dor-default-rtdb.firebaseio.com"
});

const db = admin.database();

async function updatePrices() {
  try {
    // ============================================================
    // ১. এডমিন প্যানেলের শিডিউল সেটিংস চেক করা
    // ============================================================
    const settingsSnapshot = await db.ref('app_settings/product_display').once('value');
    const settings = settingsSnapshot.val() || {};
    
    // এডমিন প্যানেলে সেট করা সময় (না থাকলে ডিফল্ট ৮ ঘণ্টা)
    const scheduleHours = parseInt(settings.updateSchedule) || 8; 
    
    // শেষ আপডেট হওয়ার সময়
    const lastUpdatedTime = settings.lastUpdated || 0; 
    const currentTimeMs = Date.now();
    const hoursPassed = (currentTimeMs - lastUpdatedTime) / (1000 * 60 * 60);

    // যদি নির্ধারিত সময় পার না হয়, তবে স্ক্রিপ্ট কিছুই করবে না
    if (hoursPassed < scheduleHours) {
        console.log(`Time not matched. Schedule: ${scheduleHours}h, Passed: ${hoursPassed.toFixed(2)}h`);
        process.exit(0);
        return;
    }

    // ============================================================
    // ২. পণ্যের দাম পরিবর্তনের স্মার্ট লজিক
    // ============================================================
    const snapshot = await db.ref('products').once('value');
    if (!snapshot.exists()) {
      console.log("No products found.");
      process.exit(0);
    }

    const updates = {};
    const currentTimeISO = new Date().toISOString();

    snapshot.forEach((childSnapshot) => {
      const product = childSnapshot.val();
      const key = childSnapshot.key;
      
      // শুধুমাত্র 'active' পণ্যের দাম পরিবর্তন হবে
      if (product.status === 'active') {
          
          let currentLow = parseFloat(product.lowest_price) || 0;
          let currentHigh = parseFloat(product.highest_price) || 0;

          // বেস প্রাইস: যদি আগে সেট করা না থাকে, বর্তমান দামকেই বেস ধরা হবে
          // এটি নিশ্চিত করে যে দাম আকাশছোঁয়া হবে না বা অনেক কমে যাবে না
          let baseLow = parseFloat(product.base_price_low);
          if (!baseLow) baseLow = currentLow; 

          // --- লজিক শুরু ---

          // ১. পরিবর্তনের পরিমাণ নির্ধারণ (Fluctuation Amount)
          // ৮০% সময় দাম ১-৩ টাকা কমবে/বাড়বে (স্বাভাবিক বাজার)
          // ২০% সময় দাম ৪-৮ টাকা কমবে/বাড়বে (হঠাৎ পরিবর্তন)
          const isStableChange = Math.random() > 0.2; 
          const changeAmount = isStableChange 
              ? Math.floor(Math.random() * 3) + 1  // ১ থেকে ৩ টাকা
              : Math.floor(Math.random() * 5) + 4; // ৪ থেকে ৮ টাকা

          // ২. বাড়া বা কমানোর সিদ্ধান্ত (Direction)
          let isIncrease;

          // যদি বর্তমান দাম বেস প্রাইসের চেয়ে ১৫ টাকা বেশি হয়ে যায়, তবে দাম কমানো হবে (Force Down)
          if (currentLow > (baseLow + 15)) {
              isIncrease = false;
          }
          // যদি বর্তমান দাম বেস প্রাইসের চেয়ে ১৫ টাকা কমে যায়, তবে দাম বাড়ানো হবে (Force Up)
          else if (currentLow < (baseLow - 15)) {
              isIncrease = true;
          }
          // অন্যথায় রেন্ডমলি বাড়বে বা কমবে (৫০-৫০ চান্স)
          else {
              isIncrease = Math.random() < 0.5;
          }

          // ৩. নতুন দাম ক্যালকুলেশন
          let newLow = isIncrease ? currentLow + changeAmount : currentLow - changeAmount;

          // ৪. সেফটি চেক (Safety Net)
          // দাম যেন কখনো ১০ টাকার নিচে না নামে (মিনিমাম লিমিট)
          if (newLow < 10) newLow = 10;
          
          // সর্বোচ্চ দাম (High Price) সেট করা
          // লো প্রাইস থেকে সবসময় ৫ থেকে ১২ টাকা বেশি থাকবে
          let spread = Math.floor(Math.random() * 8) + 5; 
          let newHigh = newLow + spread;

          // ৫. ডাটাবেস আপডেটের লিস্ট তৈরি
          updates[`/products/${key}/lowest_price`] = Math.round(newLow);
          updates[`/products/${key}/highest_price`] = Math.round(newHigh);
          updates[`/products/${key}/effective_date`] = currentTimeISO;

          // বেস প্রাইস না থাকলে সেট করে দেওয়া
          if (!product.base_price_low) {
              updates[`/products/${key}/base_price_low`] = Math.round(currentLow);
          }
      }
    });

    // ============================================================
    // ৩. ডাটাবেসে সেভ করা এবং টাইমস্ট্যাম্প আপডেট
    // ============================================================
    if (Object.keys(updates).length > 0) {
        // শেষ আপডেটের সময় রেকর্ড করা হচ্ছে
        updates['app_settings/product_display/lastUpdated'] = currentTimeMs;
        
        await db.ref().update(updates);
        console.log(`Prices updated successfully based on ${scheduleHours}h schedule.`);
    } else {
        console.log("No active products found to update.");
    }
    
    process.exit(0);

  } catch (error) {
    console.error("Error updating prices:", error);
    process.exit(1);
  }
}

updatePrices();
