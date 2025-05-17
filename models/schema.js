  const mongoose = require('mongoose');
 
 const barberSchema = new mongoose.Schema({
   name: { type: String, required: true },
   phone: { type: String, required: true, unique: true },
   password: { type: String, required: true }, // Hashed password
   price: { type: Number, required: true },
   location: { 
     lat: { type: Number, default: 0 },  // Default value to avoid undefined lat
     lng: { type: Number, default: 0 }   // Default value to avoid undefined lng
   },
   subscriptionActive: { type: Boolean, default: false },
   subscriptionExpires: Date,
   freeTrialExpires: {
     type: Date,
     default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 1-day free trial
   },
   visible: { type: Boolean, default: false },
   averageRating: { type: Number, default: 0 },
 
   // ✅ Updated ratings structure
   ratings: [
     {
       customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
       rating: { type: Number, required: true },
     }
   ],
 
   reviews: [
     {
       user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
       rating: Number,
       comment: String,
       date: { type: Date, default: Date.now },
     },
   ],
 
   services: [
     {
       name: String,
       cost: Number,
       duration: Number,
     },
   ],
 
   availability: [
     {
       dayOfWeek: {
         type: String,
         enum: [
           'Monday',
           'Tuesday',
           'Wednesday',
           'Thursday',
           'Friday',
           'Saturday',
           'Sunday',
         ],
       },
       open: String,
       close: String,
     },
   ],
 
   notifications: [
     {
       message: String,
       date: { type: Date, default: Date.now },
       read: { type: Boolean, default: false },
     },
   ],
 });
 
 // ✅ Keep previous function for updating visibility
 barberSchema.methods.updateVisibilityStatus = async function () {
   const now = new Date();
   const isSubscriptionActive = this.subscriptionExpires && this.subscriptionExpires > now;
   const isFreeTrialActive = this.freeTrialExpires && this.freeTrialExpires > now;
 
   const previousVisibility = this.visible;
   this.visible = isSubscriptionActive || isFreeTrialActive;
   this.subscriptionActive = isSubscriptionActive;
 
   try {
     await this.save();
     if (previousVisibility !== this.visible) {
       console.log(`Visibility updated for ${this.name}: ${this.visible ? 'Visible' : 'Hidden'}`);
     }
   } catch (error) {
     console.error('Error updating visibility status:', error);
   }
 
   return this;
 };
 
 module.exports = mongoose.model('Barber', barberSchema);
 