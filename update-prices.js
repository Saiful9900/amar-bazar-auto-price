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
      
      // লজিক আপডেট: পণ্যটি অবশ্যই 'active' হতে হবে এবং 'auto' মোডে থাকতে হবে
      // যদি এডমিন 'Manual' সেট করে থাকেন, তবে এই স্ক্রিপ্ট দাম পরিবর্তন করবে না
      if (product.status === 'active' && product.priceType === 'auto') {
          
          let currentLow = parseFloat(product.lowest_price) || 0;
          
          // Base Price চেক করা (এডমিন যেটা সেট করেছেন)
          let baseLow = parseFloat(product.base_price_low);
          
          // সেফটি: যদি কোনো কারণে Base Price না থাকে, বর্তমান দামকেই বেস ধরা হবে
          if (!baseLow || baseLow === 0) baseLow = currentLow; 

          // --- দাম পরিবর্তনের লজিক (আপনার বিদ্যমান লজিক অপরিবর্তিত রাখা হয়েছে) ---

          // ১. পরিবর্তনের পরিমাণ নির্ধারণ (Fluctuation Amount)
          const isStableChange = Math.random() > 0.2; 
          const changeAmount = isStableChange 
              ? Math.floor(Math.random() * 3) + 1  // ১ থেকে ৩ টাকা (স্বাভাবিক)
              : Math.floor(Math.random() * 5) + 4; // ৪ থেকে ৮ টাকা (অস্বাভাবিক)

          // ২. বাড়া বা কমানোর সিদ্ধান্ত (Smart Direction based on Base Price)
          let isIncrease;

          // লজিক: যদি বর্তমান দাম Base Price থেকে ১৫ টাকা বেশি হয়ে যায়, তবে দাম কমাবে
          if (currentLow > (baseLow + 15)) {
              isIncrease = false; // Force Down
          }
          // লজিক: যদি বর্তমান দাম Base Price থেকে ১৫ টাকা কমে যায়, তবে দাম বাড়াবে
          else if (currentLow < (baseLow - 15)) {
              isIncrease = true; // Force Up
          }
          // অন্যথায় রেন্ডমলি বাড়বে বা কমবে
          else {
              isIncrease = Math.random() < 0.5;
          }

          // ৩. নতুন দাম ক্যালকুলেশন
          let newLow = isIncrease ? currentLow + changeAmount : currentLow - changeAmount;

          // ৪. সেফটি চেক (Safety Net)
          // দাম যেন কখনো ১০ টাকার নিচে না নামে
          if (newLow < 10) newLow = 10;
          
          // সর্বোচ্চ দাম (High Price) সেট করা (লো প্রাইস থেকে ৫-১২ টাকা বেশি)
          let spread = Math.floor(Math.random() * 8) + 5; 
          let newHigh = newLow + spread;

          // ৫. ডাটাবেস আপডেটের লিস্ট তৈরি
          updates[`/products/${key}/lowest_price`] = Math.round(newLow);
          updates[`/products/${key}/highest_price`] = Math.round(newHigh);
          updates[`/products/${key}/effective_date`] = currentTimeISO;

          // যদি এই পণ্যের base_price না থাকে, তবে বর্তমান দামটিকেই বেস হিসেবে সেট করে দিবে (ভবিষ্যতের জন্য)
          if (!product.base_price_low) {
              updates[`/products/${key}/base_price_low`] = Math.round(currentLow);
              updates[`/products/${key}/base_price_high`] = Math.round(currentLow + spread);
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
        console.log("No active 'auto' pricing products found to update.");
    }
    
    process.exit(0);

  } catch (error) {
    console.error("Error updating prices:", error);
    process.exit(1);
  }
}

updatePrices();
