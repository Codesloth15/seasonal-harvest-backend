import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subscription name required'],
    trim: true,
    minLength: 2,
    maxLength: 50
  },
  price: {
    type: Number,
    required: [true, 'Subscription price required'],
    min: 0,
  },
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'GBP', 'PHP'],
    default: 'PHP'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  category: {
    type: String,
    enum: ['sports', 'news', 'games', 'lifestyle'],
    required: true
  },
  paymentMethod: { // Fixed typo from 'paymenMethod'
    type: String,
    required: true,
    trim: true,
  },
  status: { // Fixed typo from 'statues'
    type: String,
    enum: ['active', 'cancelled', 'expired'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => value <= new Date(),
      message: 'Start date must be in the past'
    }
  },
  renewalDate: { // Fixed casing to camelCase
    type: Date,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'Renewal date must be after the start date',
    },
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  }
}, { timestamps: true });

// --- PRE-SAVE HOOK ---
subscriptionSchema.pre('save', async function() {
  // 1. Auto-calculate renewalDate if missing
  if (!this.renewalDate) {
    const renewalPeriods = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365,
    };

    this.renewalDate = new Date(this.startDate);
    this.renewalDate.setDate(this.renewalDate.getDate() + renewalPeriods[this.frequency || 'monthly']);
  }

  // 2. Auto-update status to 'expired' if the date has passed
  if (this.renewalDate < new Date()) {
    this.status = 'expired';
  }

 
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;